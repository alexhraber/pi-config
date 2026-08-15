import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { watch, type FSWatcher } from "node:fs";
import { dirname, fileURLToPath, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const protocol = `
## Decapod operating protocol

Preserve the user's exact original intent and scope. Keep intent, context,
assumptions, uncertainty, action, evidence, and proof distinct. Orient and
resolve context before non-trivial inference. A Decision Gate requests human
judgment: stop and ask, never guess. Confidence is not evidence. Never claim
completion without named, observed proof. Use only public Decapod CLI commands;
never write .decapod state directly.
`;

type JsonObject = Record<string, unknown>;
type Result = { ok: boolean; text: string; json?: unknown };
type UiContext = {
  ui: {
    setWidget: (id: string, lines: string[]) => void;
    setStatus: (id: string, text: string | undefined) => void;
    notify: (text: string, level: "info" | "warning" | "error") => void;
  };
};

async function run(args: string[], input?: string): Promise<Result> {
  try {
    const { stdout = "", stderr = "" } = await execFileAsync("decapod", args, {
      input,
      encoding: "utf8",
      timeout: 20_000,
      maxBuffer: 512 * 1024,
    });
    let json: unknown;
    try {
      json = JSON.parse(stdout);
    } catch {
      /* text remains useful */
    }
    return {
      ok: true,
      text: `${stdout}${stderr}`.trim() || "Decapod returned no output.",
      json,
    };
  } catch (error) {
    const failure = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
      code?: number | string;
      killed?: boolean;
    };
    const text =
      `${failure.stdout ?? ""}${failure.stderr ?? ""}`.trim() ||
      failure.message ||
      "Unable to run Decapod.";
    let json: unknown;
    try {
      json = JSON.parse(failure.stdout ?? "");
    } catch {
      /* text remains useful */
    }
    return {
      ok: false,
      text: `${text}${failure.killed ? " (timed out)" : ""}`,
      json,
    };
  }
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
      if (
        /decision.?gate|approval|human.?judgment|requires.?decision/i.test(key)
      ) {
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
function display(result: Result, max = 14): string[] {
  const source =
    result.json === undefined
      ? result.text
      : JSON.stringify(result.json, null, 2);
  return source.split("\n").slice(0, max);
}
function assistantText(ctx: {
  sessionManager: { getBranch: () => unknown[] };
}): string {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const message = object(object(branch[i])?.message);
    if (message?.role !== "assistant") continue;
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content))
      return message.content
        .map((part) => object(part)?.text)
        .filter((text): text is string => typeof text === "string")
        .join("\n");
  }
  return "";
}
function toolText(toolName: string, input: unknown): string {
  return `Agent tool request (${toolName}):\n${JSON.stringify(input, null, 2)}`;
}

export default function decapod(pi: ExtensionAPI) {
  let originalIntent = "";
  let orientation: Result | undefined;
  let profile = "general";
  let proofState = "not-run";
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  let reloadQueued = false;
  let watchers: FSWatcher[] = [];

  const closeWatchers = () => {
    for (const watcher of watchers) watcher.close();
    watchers = [];
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = undefined;
  };

  const widget = (ctx: UiContext, title: string, lines: string[] = []) => {
    const body = lines.length
      ? lines.map((line) => `│ ${line}`)
      : ["│ ready for intent"];
    ctx.ui.setWidget("decapod", [`╭─ ${title}`, ...body, "╰─ decapod"]);
  };
  const show = (
    ctx: UiContext,
    title: string,
    result: Result,
    extra: string[] = [],
  ) => widget(ctx, title, [...extra, ...display(result)]);
  const setPhase = (ctx: UiContext, phase: string) =>
    ctx.ui.setStatus("decapod", `🦀 ${phase}  ·  ${profile}  ·  ${proofState}`);

  pi.on("session_start", async (_event, ctx) => {
    originalIntent = "";
    orientation = undefined;
    proofState = "not-run";
    for (const entry of ctx.sessionManager.getEntries()) {
      const custom = object(entry);
      if (
        custom?.type !== "custom" ||
        custom.customType !== "decapod-checkpoint"
      )
        continue;
      const data = object(custom.data);
      if (typeof data?.intent === "string") originalIntent = data.intent;
      if (typeof data?.profile === "string") profile = data.profile;
      if (typeof data?.proof === "string") proofState = data.proof;
    }
    setPhase(ctx, proofState === "passed" ? "proof available" : "ready");
    widget(ctx, "🦀 Decapod · intent → context → proof", [
      "quiet governance active",
      "Ctrl+Shift+D  status   ·   Ctrl+Shift+P  preflight",
      "type naturally · evidence appears when it matters",
    ]);

    if (process.env.PI_CONFIG_AUTO_RELOAD === "0") return;
    const packageRoot =
      process.env.PI_CONFIG_ROOT ??
      dirname(dirname(fileURLToPath(import.meta.url)));
    const watched = [
      { path: join(packageRoot, "extensions"), names: new Set(["decapod.ts"]) },
      {
        path: join(packageRoot, "themes"),
        names: new Set(["decapod-atelier.json"]),
      },
      { path: join(packageRoot, "prompts"), names: undefined },
      {
        path: packageRoot,
        names: new Set(["README.md", "package.json", "install.sh"]),
      },
    ];
    const queueReload = () => {
      if (reloadQueued || reloadTimer) return;
      reloadTimer = setTimeout(() => {
        reloadTimer = undefined;
        reloadQueued = true;
        closeWatchers();
        widget(ctx, "↻ pi-config updated", [
          "new configuration detected",
          "reloading after the current turn settles",
        ]);
        pi.sendUserMessage("/decapod-reload", { deliverAs: "followUp" });
      }, 500);
    };
    for (const entry of watched) {
      try {
        watchers.push(
          watch(entry.path, (_event, filename) => {
            const name = filename?.toString();
            if (!name || !entry.names || entry.names.has(name)) queueReload();
          }),
        );
      } catch {
        // A missing optional resource directory should not prevent pi startup.
      }
    }
  });

  pi.on("session_shutdown", () => {
    closeWatchers();
  });

  pi.on("input", async (event, ctx) => {
    if (!event.text.trim() || event.source === "extension") return;
    const intent = event.text.trim();
    setPhase(ctx, "evaluating");
    const evaluation = await run(
      ["eval", "--stdin", "--format", "json"],
      event.text,
    );
    if (!evaluation.ok || status(evaluation.json) !== "allow") {
      setPhase(ctx, "human review");
      ctx.ui.notify("Decapod stopped this prompt for human review.", "error");
      show(ctx, "🛑 Decapod safety gate", evaluation, [
        "The original intent was not sent to the agent.",
      ]);
      return { action: "handled" as const };
    }
    const orient = await run([
      "infer",
      "orientation",
      "--intent",
      intent,
      "--format",
      "json",
    ]);
    if (!orient.ok || hasDecisionGate(orient.json ?? orient.text)) {
      setPhase(ctx, "Decision Gate");
      ctx.ui.notify(
        "Orientation requires human judgment before work can continue.",
        "warning",
      );
      show(ctx, "🛑 Decapod Decision Gate", orient, [
        "No inference or implementation was started.",
        "Resolve the gate, then resubmit the original intent.",
      ]);
      return { action: "handled" as const };
    }
    const context = await run([
      "rpc",
      "--op",
      "context.resolve",
      "--params",
      "{}",
    ]).catch(() => ({ ok: false, text: "Context resolution failed." }));
    if (!context.ok || hasDecisionGate(context.json ?? context.text)) {
      setPhase(ctx, "context gate");
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
    const preflight = await run([
      "context",
      "preflight",
      "--op",
      "inference",
      "--format",
      "json",
    ]);
    setPhase(ctx, "oriented");
    show(ctx, "🧭 Decapod orientation ready", preflight, [
      "intent preserved · context resolved · assumptions remain explicit",
    ]);
    return { action: "continue" as const };
  });

  pi.on("before_agent_start", (event) => {
    const governed = originalIntent
      ? `\n\n## Governed request packet\nProfile: ${profile}\nOriginal user intent (verbatim):\n${originalIntent}\n\nDecapod orientation (machine output):\n${orientation?.text ?? "unavailable"}\n\nCarry unresolved assumptions and uncertainty forward. Distinguish evidence from confidence. Before saying complete, name exact checks and observed results; if proof is unavailable, say so and escalate.`
      : "";
    return { systemPrompt: `${event.systemPrompt}\n${protocol}${governed}` };
  });

  // Govern model-issued side effects at the tool boundary, not only at prompt entry.
  pi.on("tool_call", async (event) => {
    const evaluation = await run(
      ["eval", "--stdin", "--format", "json"],
      toolText(event.toolName, event.input),
    );
    if (!evaluation.ok || status(evaluation.json) !== "allow")
      return {
        block: true,
        terminate: true,
        reason: `Decapod blocked ${event.toolName}: ${evaluation.text.slice(0, 300)}`,
      };
    if (hasDecisionGate(evaluation.json ?? evaluation.text))
      return {
        block: true,
        terminate: true,
        reason: `Decapod Decision Gate for ${event.toolName}; human judgment required.`,
      };
  });

  pi.on("user_bash", async (event) => {
    const evaluation = await run(
      ["eval", "--stdin", "--format", "json"],
      `User requested shell command:\n${event.command}`,
    );
    if (
      evaluation.ok &&
      status(evaluation.json) === "allow" &&
      !hasDecisionGate(evaluation.json ?? evaluation.text)
    )
      return;
    return {
      result: {
        output: `🛑 Decapod blocked this shell command.\n${evaluation.text}`,
        exitCode: 126,
        cancelled: false,
        truncated: false,
      },
    };
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (!originalIntent) return;
    setPhase(ctx, "verifying");
    const inference = await run([
      "infer",
      "validate",
      "--intent",
      originalIntent,
      "--result",
      assistantText(ctx) || "(no assistant result)",
      "--format",
      "json",
    ]);
    const validation = await run(["validate", "--format", "json"]);
    const passed =
      inference.ok &&
      validation.ok &&
      !hasDecisionGate(inference.json ?? inference.text) &&
      !hasDecisionGate(validation.json ?? validation.text);
    proofState = passed ? "passed" : "unproven";
    pi.appendEntry("decapod-checkpoint", {
      intent: originalIntent,
      profile,
      proof: proofState,
      inference: inference.ok,
      validation: validation.ok,
    });
    setPhase(ctx, passed ? "proof available" : "proof required");
    widget(
      ctx,
      passed ? "✅ Decapod proof available" : "⚠️ Completion not proven",
      [
        `intent: ${originalIntent.slice(0, 160)}`,
        "inference validation:",
        ...display(inference, 5),
        "repository validation:",
        ...display(validation, 5),
      ],
    );
    ctx.ui.notify(
      passed
        ? "Evidence-backed verification is available."
        : "Do not claim completion: proof is missing or a gate remains.",
      passed ? "info" : "warning",
    );
  });

  pi.registerCommand("decapod-reload", {
    description: "Reload pi-config after a pulled configuration change",
    handler: async (_args, ctx) => {
      closeWatchers();
      await ctx.reload();
    },
  });

  pi.registerShortcut("ctrl+shift+d", {
    description: "Show Decapod governance status",
    handler: async (ctx) => {
      const result = await run(["session", "status"]);
      show(ctx, "🦀 Decapod status", result, [
        `profile: ${profile}`,
        `proof: ${proofState}`,
      ]);
    },
  });
  pi.registerShortcut("ctrl+shift+p", {
    description: "Run Decapod preflight",
    handler: async (ctx) => {
      const result = await run([
        "context",
        "preflight",
        "--op",
        "inference",
        "--format",
        "json",
      ]);
      show(ctx, "🔭 Decapod preflight", result);
    },
  });

  pi.registerCommand("decapod", {
    description: "Show Decapod status and governed workflow",
    handler: async (_args, ctx) => {
      const result = await run(["session", "status"]);
      show(ctx, "🦀 Decapod status", result, [
        `profile: ${profile}`,
        `proof: ${proofState}`,
        "Ctrl+Shift+D status · Ctrl+Shift+P preflight",
      ]);
    },
  });
  pi.registerCommand("mode", {
    description: "Set a personal workflow profile",
    handler: async (args, ctx) => {
      const next = args.trim().toLowerCase() || "general";
      profile = next.slice(0, 32);
      pi.appendEntry("decapod-checkpoint", {
        intent: originalIntent,
        profile,
        proof: proofState,
      });
      setPhase(ctx, "profile set");
      widget(ctx, `✦ pi profile · ${profile}`, [
        "The profile is carried into the next governed request.",
        "Suggested: coding · research · writing · planning · operations",
      ]);
    },
  });
  pi.registerCommand("orient", {
    description: "Get a Decapod orientation packet before acting",
    handler: async (args, ctx) => {
      const intent =
        args.trim() || originalIntent || "the current user request";
      const result = await run([
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
      const result = await run([
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
      const result = await run(["validate", "--format", "json"]);
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
      widget(ctx, "📜 Governed handoff", [
        "□ original intent and boundaries (verbatim)",
        "□ profile, orientation, and resolved context",
        "□ assumptions, uncertainty, and unresolved Decision Gates",
        "□ actions and changed files",
        "□ evidence (exact checks and observed results), not confidence",
        "□ Decapod task/session identifiers",
        "□ one explicit next action or human escalation",
      ]);
    },
  });
}
