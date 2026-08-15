# pi-config · Decapod Atelier

A Decapod-centered operating system for [pi](https://pi.dev): a calm visual
workspace where governance is automatic rather than a workflow the user must
remember.

## What is included

- `themes/decapod-atelier.json` — a dark, high-contrast atelier theme.
- `prompts/` — `/orient`, `/review`, `/ship`, and `/handoff` prompt templates.
- `extensions/decapod-atelier.ts` — the automatic governance front door:
  safety evaluation, orientation, context resolution, Decision Gates,
  uncertainty custody, and proof-backed settling.
- `.decapod/` — repository-local governance and living specifications.
- `install.sh` — an idempotent installer that links the package into pi.

The extension is deliberately thin: pi renders the experience, Decapod owns
governance state, and the repository remains the durable record. It never
writes `.decapod` directly and never turns a failed check into proof.

## Install

Requirements: pi, a working `decapod` executable, and Python 3.

```bash
git clone <your-public-repository-url>/pi-config.git
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
extension never guesses a human decision. At agent settlement it validates both
the inference result and the repository, and labels missing or failed proof as
unproven. Confidence is never displayed as evidence.

Useful explicit affordances remain available: `/decapod` (status), `/orient
[intent]`, `/preflight [operation]`, `/verify` (validation evidence), and
`/handoff` (durable custody checklist). `/review` and `/ship` are reusable
prompt templates, not substitutes for Decapod validation.

Prompt safety and Decision Gates are automatic hard stops. The extension uses
only public Decapod CLI commands and never writes `.decapod` state directly.

## Development and checks

From an isolated Decapod workspace:

```bash
python3 -m json.tool themes/decapod-atelier.json >/dev/null
bash -n install.sh
npx --yes prettier --check extensions/decapod-atelier.ts prompts/*.md README.md
decapod validate
```

The TypeScript extension is loaded by pi's package metadata and imports
`ExtensionAPI` from pi; type-check it in a pi development environment. Do not
run the extension as a standalone Node program.

## Public-repository boundaries

No credentials, session tokens, machine paths, or remote are committed. The
installer never sends data over the network. Decapod state is accessed through
its CLI, not by hand-editing `.decapod` files. Forks should update the clone
URL above and adapt their project governance/specs before publishing.
