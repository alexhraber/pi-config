import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "node:child_process";

const protocol = `
## Decapod operating protocol

This task is governed by Decapod. Preserve the user's exact original intent and
scope. Keep intent, context, assumptions, uncertainty, action, evidence, and
proof distinct. Decapod orientation and context are required before non-trivial
inference. A Decision Gate is a request for human judgment: stop and ask, never
guess. Confidence is not evidence. Do not claim completion unless the claim is
backed by named, observed proof; report unavailable or failed checks honestly.
Use only public Decapod CLI commands and never write .decapod state directly.
`;

type JsonObject = Record<string, unknown>;
type Result = { ok: boolean; text: string; json?: unknown };

function run(args: string[], input?: string): Result {
  const result = spawnSync("decapod", args, {
    input,
    encoding: "utf8",
    timeout: 20_000,
    maxBuffer: 512 * 1024,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    /* text remains useful */
  }
  if (result.error)
    return {
      ok: false,
      text: `Unable to run Decapod: ${result.error.message}`,
    };
  if (result.signal)
    return { ok: false, text: `Decapod stopped by ${result.signal}.` };
  return {
    ok: result.status === 0,
    text: `${stdout}${stderr}`.trim() || "Decapod returned no output.",
    json,
  };
}

function object(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function status(value: unknown): string | undefined {
  return object(value)?.status?.toString().toLowerCase();
}

function hasDecisionGate(value: unknown): boolean {
  if (typeof value === "string")
    return /(?:decision\s*gate|approval required|human\s+(?:judgment|decision))\s*[:：-]\s*(?:yes|true|required|pending|open)/i.test(
      value,
    );
  if (Array.isArray(value)) return value.some(hasDecisionGate);
  if (value && typeof value === "object")
    return Object.entries(value).some(([key, child]) => {
      const gateField =
        /decision.?gate|approval|human.?judgment|requires.?decision/i.test(key);
      if (gateField) {
        if (child === true) return true;
        if (typeof child === "string")
          return !/^(?:none|false|no|resolved|closed|optional)$/i.test(
            child.trim(),
          );
        if (Array.isArray(child)) return child.length > 0;
        return Boolean(
          child && typeof child === "object" && Object.keys(child).length > 0,
        );
      }
      return hasDecisionGate(child);
    });
  return false;
}

function display(result: Result, max = 16): string[] {
  const source =
    result.json === undefined
      ? result.text
      : JSON.stringify(result.json, null, 2);
  return source.split("\n").slice(0, max);
}

function lastAssistantText(ctx: {
  sessionManager: { getBranch: () => unknown[] };
}): string {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = object(branch[i]);
    const message = object(entry?.message);
    if (message?.role !== "assistant") continue;
    const content = message.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => object(part)?.text)
        .filter((text): text is string => typeof text === "string")
        .join("\n");
    }
  }
  return "";
}

export default function decapodAtelier(pi: ExtensionAPI) {
  let originalIntent = "";
  let orientation: Result | undefined;

  const show = (
    ctx: { ui: { setWidget: (id: string, lines: string[]) => void } },
    title: string,
    result: Result,
    extra: string[] = [],
  ) => {
    ctx.ui.setWidget("decapod", [title, ...extra, ...display(result)]);
  };

  pi.on("session_start", (_event, ctx) => {
    originalIntent = "";
    orientation = undefined;
    ctx.ui.setStatus("decapod", "🦀 governed");
    ctx.ui.setWidget("decapod", [
      "🦀 Decapod Atelier  ·  intent → context → proof",
    ]);
  });

  // This is the automatic front door: unsafe, unoriented, or unresolved work
  // never reaches the model. The original text is passed unchanged to Decapod
  // and later included verbatim in the governed context message.
  pi.on("input", (event, ctx) => {
    if (!event.text.trim() || event.source === "extension") return;
    const intent = event.text.trim();
    const evaluation = run(["eval", "--stdin", "--format", "json"], event.text);
    if (!evaluation.ok || status(evaluation.json) !== "allow") {
      ctx.ui.notify("Decapod stopped this prompt for human review.", "error");
      show(ctx, "🛑 Decapod safety gate", evaluation, [
        "The original intent was not sent to the agent.",
      ]);
      return { action: "handled" as const };
    }

    const orient = run([
      "infer",
      "orientation",
      "--intent",
      intent,
      "--format",
      "json",
    ]);
    if (!orient.ok || hasDecisionGate(orient.json ?? orient.text)) {
      ctx.ui.notify(
        "Decapod orientation requires human judgment before work can continue.",
        "warning",
      );
      show(ctx, "🛑 Decapod Decision Gate", orient, [
        "No inference or implementation was started.",
        "Resolve the gate, then resubmit the original intent.",
      ]);
      return { action: "handled" as const };
    }

    const context = run(["rpc", "--op", "context.resolve", "--params", "{}"]);
    if (!context.ok || hasDecisionGate(context.json ?? context.text)) {
      ctx.ui.notify(
        "Decapod could not resolve governed context; work is paused.",
        "warning",
      );
      show(ctx, "🛑 Decapod context gate", context, [
        "No implementation was started.",
      ]);
      return { action: "handled" as const };
    }

    originalIntent = intent;
    orientation = orient;
    const preflight = run([
      "context",
      "preflight",
      "--op",
      "inference",
      "--format",
      "json",
    ]);
    show(ctx, "🧭 Decapod orientation ready", preflight, [
      "intent preserved · context resolved · assumptions must remain explicit",
    ]);
    return { action: "continue" as const };
  });

  pi.on("before_agent_start", (event) => {
    const governed = originalIntent
      ? `\n\n## Governed request packet\nOriginal user intent (verbatim):\n${originalIntent}\n\nDecapod orientation (machine output):\n${orientation?.text ?? "unavailable"}\n\nCarry unresolved assumptions and uncertainty forward. Distinguish evidence from confidence. Before saying complete, name the exact checks and observed results; if proof is unavailable, say so and escalate.`
      : "";
    return { systemPrompt: `${event.systemPrompt}\n${protocol}${governed}` };
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (!originalIntent) return;
    const resultText = lastAssistantText(ctx);
    const inference = run([
      "infer",
      "validate",
      "--intent",
      originalIntent,
      "--result",
      resultText || "(no assistant result)",
      "--format",
      "json",
    ]);
    const validation = run(["validate", "--format", "json"]);
    const proofOk =
      inference.ok &&
      validation.ok &&
      !hasDecisionGate(inference.json ?? inference.text) &&
      !hasDecisionGate(validation.json ?? validation.text);
    ctx.ui.setWidget("decapod", [
      proofOk
        ? "✅ Decapod proof checks passed (evidence available)"
        : "⚠️ Completion not proven (human review required)",
      `intent: ${originalIntent.slice(0, 160)}`,
      "inference validation:",
      ...display(inference, 6),
      "repository validation:",
      ...display(validation, 6),
    ]);
    ctx.ui.notify(
      proofOk
        ? "Evidence-backed verification is available; inspect it before claiming completion."
        : "Do not claim completion: proof is missing or a gate remains.",
      proofOk ? "info" : "warning",
    );
  });

  pi.registerCommand("decapod", {
    description: "Show Decapod status and the governed workflow",
    handler: async (_args, ctx) => {
      const result = run(["session", "status"]);
      show(ctx, "🦀 Decapod status", result, [
        "Next: submit intent · /preflight · /verify · /handoff",
      ]);
    },
  });

  pi.registerCommand("orient", {
    description: "Get a Decapod orientation packet before acting",
    handler: async (args, ctx) => {
      const intent =
        args.trim() || originalIntent || "the current user request";
      const result = run([
        "infer",
        "orientation",
        "--intent",
        intent,
        "--format",
        "json",
      ]);
      show(
        ctx,
        hasDecisionGate(result.json ?? result.text)
          ? "🛑 Orientation Decision Gate"
          : "🧭 Orientation",
        result,
      );
      ctx.ui.notify(
        result.ok && !hasDecisionGate(result.json ?? result.text)
          ? "Orientation ready."
          : "Orientation needs human attention.",
        result.ok ? "info" : "warning",
      );
    },
  });

  pi.registerCommand("preflight", {
    description: "Ask Decapod what may fail before an operation",
    handler: async (args, ctx) => {
      const result = run([
        "context",
        "preflight",
        "--op",
        args.trim() || "inference",
        "--format",
        "json",
      ]);
      show(ctx, "🔭 Decapod preflight", result);
    },
  });

  pi.registerCommand("verify", {
    description: "Run Decapod validation and show its evidence",
    handler: async (_args, ctx) => {
      const result = run(["validate", "--format", "json"]);
      show(
        ctx,
        result.ok
          ? "✅ Decapod validation passed"
          : "⚠️ Decapod validation found gates",
        result,
      );
      ctx.ui.notify(
        result.ok
          ? "Validation evidence is available."
          : "Validation requires attention; completion is not proven.",
        result.ok ? "info" : "warning",
      );
    },
  });

  pi.registerCommand("handoff", {
    description: "Show the Decapod handoff checklist",
    handler: async (_args, ctx) => {
      ctx.ui.setWidget("decapod", [
        "📜 Governed handoff checklist",
        "□ original intent and boundaries (verbatim)",
        "□ orientation and resolved context",
        "□ assumptions, uncertainty, and unresolved Decision Gates",
        "□ actions and changed files",
        "□ evidence (exact checks and observed results), not confidence",
        "□ Decapod task/session identifiers",
        "□ one explicit next action or human escalation",
      ]);
    },
  });
}
