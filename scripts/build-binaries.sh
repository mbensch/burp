#!/usr/bin/env bash
set -euo pipefail

ENTRY="src/index.tsx"
OUT_DIR="dist"

mkdir -p "$OUT_DIR"

TARGETS=(
  "bun-darwin-arm64:burp-darwin-arm64"
  "bun-darwin-x64:burp-darwin-x64"
  "bun-linux-arm64:burp-linux-arm64"
  "bun-linux-x64:burp-linux-x64"
)

for pair in "${TARGETS[@]}"; do
  target="${pair%%:*}"
  outfile="${OUT_DIR}/${pair##*:}"
  echo "Building $outfile (target: $target)…"
  bun build --compile --define 'process.env.DEV="false"' --target="$target" "$ENTRY" --outfile "$outfile"
done

echo ""
echo "Built binaries:"
ls -lh "$OUT_DIR"/burp-* 2>/dev/null || true
