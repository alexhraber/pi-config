import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "node:child_process";

const protocol = `
## Decapod operating protocol

This task is governed by Decapod. Preserve the user's original intent and distinguish intent, assumptions, action, and proof. Before non-trivial work, orient with Decapod. Treat Decision Gates as requests for human judgment, not invitations to guess. Stay within scope, prefer evidence over confidence, and never claim completion without validation evidence. Do not mutate .decapod state directly; use the Decapod CLI.
`;

type Result = { ok: boolean; text: string; json?: Record<string, unknown> };

function run(args: string[], input?: string): Result {
  const result = spawnSync("decapod", args, {
    input,
    encoding: "utf8",
    timeout: 15_000,
    maxBuffer: 256 * 1024,
  });
  const text = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  let json: Record<string, unknown> | undefined;
  try { json = JSON.parse(result.stdout || ""); } catch { /* text is still useful */ }
  return { ok: result.status === 0, text: text || (result.error ? String(result.error) : "No output"), json };
}

function lines(result: Result): string[] {
  return result.text.split("\n").slice(0, 14);
}

export default function decapodAtelier(pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setStatus("decapod", "🦀 governed");
    ctx.ui.setWidget("decapod", ["🦀 Decapod Atelier  ·  intent → context → proof"]);
  });

  // Prompt safety is the one automatic hard gate: Decapod decides whether raw
  // user intent is safe to pass into the agent loop.
  pi.on("input", (event, ctx) => {
    if (!event.text.trim() || event.source === "extension") return;
    const result = run(["eval", "--stdin", "--format", "json"], event.text);
    if (!result.ok || result.json?.status === "block") {
      ctx.ui.notify("Decapod blocked this prompt. Review it before proceeding.", "error");
      ctx.ui.setWidget("decapod", ["🛑 Decapod gate: human review required", ...lines(result)]);
      return { action: "handled" as const };
    }
    ctx.ui.setWidget("decapod", ["🦀 Decapod gate: allow", "   intent accepted · orient before acting"]);
    return { action: "continue" as const };
  });

  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}\n${protocol}`,
  }));

  pi.registerCommand("decapod", {
    description: "Show Decapod status and the governed workflow",
    handler: async (_args, ctx) => {
      const result = run(["session", "status"]);
      ctx.ui.setWidget("decapod", ["🦀 Decapod status", ...lines(result), "", "Next: /orient · /preflight · /verify"]);
    },
  });

  pi.registerCommand("orient", {
    description: "Get a Decapod orientation packet before acting",
    handler: async (args, ctx) => {
      const intent = args.trim() || "the current user request";
      const result = run(["infer", "orientation", "--intent", intent, "--format", "text"]);
      ctx.ui.setWidget("decapod", ["🧭 Orientation", ...lines(result)]);
      ctx.ui.notify(result.ok ? "Orientation ready." : "Orientation needs attention.", result.ok ? "info" : "warning");
    },
  });

  pi.registerCommand("preflight", {
    description: "Ask Decapod what may fail before an operation",
    handler: async (args, ctx) => {
      const op = args.trim() || "validate";
      const result = run(["context", "preflight", "--op", op, "--format", "text"]);
      ctx.ui.setWidget("decapod", ["🔭 Preflight: " + op, ...lines(result)]);
    },
  });

  pi.registerCommand("verify", {
    description: "Run Decapod validation",
    handler: async (_args, ctx) => {
      const result = run(["validate", "--format", "text"]);
      ctx.ui.setWidget("decapod", [result.ok ? "✅ Decapod validation passed" : "⚠️ Decapod validation found gates", ...lines(result)]);
      ctx.ui.notify(result.ok ? "Validation passed." : "Validation requires attention.", result.ok ? "info" : "warning");
    },
  });

  pi.registerCommand("handoff", {
    description: "Show the Decapod handoff checklist",
    handler: async (_args, ctx) => {
      ctx.ui.setWidget("decapod", [
        "📜 Governed handoff checklist",
        "□ original intent and boundaries",
        "□ current state and changed files",
        "□ assumptions and unresolved Decision Gates",
        "□ Decapod task/session identifiers",
        "□ checks run with exact evidence",
        "□ one explicit next action",
      ]);
    },
  });
}
