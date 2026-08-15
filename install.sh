#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_DIR="${HOME}/.pi/agent"
mkdir -p "${PI_DIR}/themes" "${PI_DIR}/prompts" "${PI_DIR}/extensions"

if [[ -f "${PI_DIR}/settings.json" ]]; then
  cp "${PI_DIR}/settings.json" "${PI_DIR}/settings.json.pi-config-backup.$(date +%Y%m%d%H%M%S)"
fi

rm -f "${PI_DIR}/themes/decapod-atelier.json"
ln -sfn "${ROOT}/themes/decapod.json" "${PI_DIR}/themes/decapod.json"
ln -sfn "${ROOT}/prompts" "${PI_DIR}/prompts/pi-config-decapod"
rm -f "${PI_DIR}/extensions/decapod-atelier.ts"
ln -sfn "${ROOT}/extensions/decapod.ts" "${PI_DIR}/extensions/decapod.ts"

python3 - "${PI_DIR}/settings.json" "${ROOT}" <<'PY'
import json, pathlib, sys
settings_path, root = map(pathlib.Path, sys.argv[1:])
data = json.loads(settings_path.read_text()) if settings_path.exists() else {}
data.update({"theme": "decapod", "editorPaddingX": 1, "outputPad": 1, "autocompleteMaxVisible": 8})
for key, value in {
    "themes": [str(root / "themes")],
    "prompts": [str(root / "prompts")],
    "extensions": [str(root / "extensions" / "decapod.ts")],
}.items():
    existing = data.get(key, [])
    # Remove the old atelier extension path if an older installation left it
    # behind; otherwise pi attempts to load a file that no longer exists.
    if key == "extensions":
        legacy = str(root / "extensions" / "decapod-atelier.ts")
        existing = [path for path in existing if path != legacy]
    data[key] = list(dict.fromkeys(existing + value))
settings_path.write_text(json.dumps(data, indent=2) + "\n")
PY

echo "Installed pi-config from ${ROOT}"
echo "Restart pi or run /reload; try /orient and /decapod."
