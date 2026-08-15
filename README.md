# pi-config · Decapod Atelier

[![🦀 Decapod](https://img.shields.io/badge/🦀%20Decapod-v0.99.4-dc2626)](https://github.com/DecapodLabs/decapod)

A Decapod-centered operating system for [pi](https://pi.dev): a calm visual
workspace where governance is automatic rather than a workflow the user must
remember.

## What is included

- `themes/decapod-atelier.json` — a dark, high-contrast atelier theme.
- `prompts/` — `/orient`, `/review`, `/ship`, and `/handoff` prompt templates.
- `extensions/decapod.ts` — the automatic Decapod governance front door for pi:
  safety evaluation, orientation, context resolution, Decision Gates,
  uncertainty custody, and proof-backed settling.
- `.decapod/` — repository-local governance and living specifications.
- `install.sh` — an idempotent installer that links the package into pi.

The extension is deliberately thin: pi renders the experience, Decapod owns
governance state, and the repository remains the durable record. It never
writes `.decapod` directly and never turns a failed check into proof.

The visual system is intentionally information-dense without being loud: the
footer carries a compact phase/profile/proof tuple, while the framed Decapod
widget shows the next useful action, gate, or evidence. Routine governance
stays in the periphery; human attention is reserved for uncertainty and
Decision Gates.

## Install

Requirements: pi, a working `decapod` executable, and Python 3.

```bash
git clone git@github.com:alexhraber/pi-config.git
cd pi-config
./install.sh
```

The installer creates `~/.pi/agent/{themes,prompts,extensions}`, backs up an
existing `settings.json`, links this checkout, and merges only the pi-config
settings it owns. It refuses to overwrite malformed or non-object JSON.
Restart pi or run `/reload`, then select `decapod-atelier` if needed.

Because links point at this checkout, `git pull` updates the installed files;
move the checkout only after rerunning the installer. To remove the package,
remove the three `pi-config-decapod` / `decapod-atelier` links and revert the
settings keys using your backup.

## Governed rhythm

```text
natural-language intent
  → safety evaluation
  → orientation + resolved context + preflight
  → governed inference and implementation
  → evidence-backed settling
  → honest completion or explicit escalation
```

The `input` hook automatically evaluates every non-command prompt, obtains an
orientation packet, resolves Decapod context, and runs preflight before the
model sees it. It preserves the original request verbatim in a governed packet.
A safety failure, missing context, or Decision Gate stops the turn; the
extension never guesses a human decision. The extension also governs model
side effects at the `tool_call` boundary and user shell commands, so safety is
not only a prompt-entry concern. At agent settlement it validates both the
inference result and the repository, persists a compact session checkpoint,
and labels missing or failed proof as unproven. Confidence is never displayed
as evidence.

Useful explicit affordances remain available: `/decapod` (status), `/mode
[profile]` (coding, research, writing, planning, or operations), `/orient
[intent]`, `/preflight [operation]`, `/verify` (validation evidence), and
`/handoff` (durable custody checklist). `Ctrl+Shift+D` opens status and
`Ctrl+Shift+P` runs preflight. `/review` and `/ship` are reusable prompt
templates, not substitutes for Decapod validation.

Prompt safety and Decision Gates are automatic hard stops. The extension uses
only public Decapod CLI commands and never writes `.decapod` state directly.

## Development and checks

From an isolated Decapod workspace:

```bash
python3 -m json.tool themes/decapod-atelier.json >/dev/null
bash -n install.sh
npx --yes prettier --check extensions/decapod.ts prompts/*.md README.md
decapod validate
```

The TypeScript extension is loaded by pi's package metadata and imports
`ExtensionAPI` from pi; type-check it in a pi development environment. It uses
non-blocking Decapod subprocess calls so the UI remains responsive. Do not run
the extension as a standalone Node program.

## Public-repository boundaries

No credentials, session tokens, machine paths, or remote are committed. The
installer never sends data over the network. Decapod state is accessed through
its CLI, not by hand-editing `.decapod` files. Forks should adapt their project
governance/specs before publishing.
