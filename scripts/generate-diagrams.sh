#!/usr/bin/env bash
# Renders every Mermaid (.mmd) source file under docs/diagrams/ to an .svg
# sitting right beside it. Auto-discovers new diagrams — nothing hardcoded.
#
# Usage: bash scripts/generate-diagrams.sh
# Requires Node.js (npx pulls @mermaid-js/mermaid-cli on first run).
set -euo pipefail
cd "$(dirname "$0")/.."

found=0
while IFS= read -r -d '' mmd; do
  found=1
  svg="${mmd%.mmd}.svg"
  echo "Rendering $mmd -> $svg"
  npx -y @mermaid-js/mermaid-cli -i "$mmd" -o "$svg" -p scripts/puppeteer-config.json
done < <(find docs/diagrams -name '*.mmd' -print0)

if [ "$found" -eq 0 ]; then
  echo "No .mmd files found under docs/diagrams/."
fi
