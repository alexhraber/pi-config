# pi-config

A Decapod-centered operating system for [pi](https://pi.dev): beautiful, intentional, and proof-aware.

## Design

- **Intent before action:** every natural-language task passes through `decapod eval`.
- **Orientation before inference:** use `/orient` to ask Decapod for a governed orientation packet.
- **Proof before completion:** use `/verify` and `decapod validate` before declaring work done.
- **Human authority:** a Decision Gate stops the flow rather than guessing.
- **Low ceremony:** the integration is advisory except for Decapod's explicit prompt-safety block.

## Install

```bash
./install.sh
```

The installer backs up `~/.pi/agent/settings.json`, links this repo's theme, prompts, and extension, and enables the `decapod-atelier` theme. Restart pi or run `/reload`.

## Commands

- `/decapod` — show Decapod session status and available next steps
- `/orient [intent]` — get a Decapod orientation packet
- `/preflight [intent]` — run a preflight check
- `/verify` — validate the current repository
- `/handoff` — print a compact handoff checklist

## Suggested rhythm

```text
/refine intent → /orient → work → /preflight → tests → /verify → publish
```

The extension never writes `.decapod` state directly. It only invokes the public CLI.

## Public-repo notes

This repository contains no credentials, session tokens, or project governance state. It is intended to be forked and adapted. The GitHub remote is deliberately not created automatically; add your own remote when you are ready.
