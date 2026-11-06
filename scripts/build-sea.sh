#!/usr/bin/env bash
# Builds a Node single executable application (SEA) for the current platform: dist/rowattest-gate.
# The same entry esbuild bundles into dist/rowattest-gate.js is bundled once more as CommonJS, because an SEA main
# script is loaded as CommonJS; then node --experimental-sea-config (sea-config.json) and postject inject it into a copy
# of the node binary. On macOS the copy's signature is removed before the injection and an ad hoc one added after.
set -euo pipefail
cd "$(dirname "$0")/.."
npx --no-install esbuild src/cli.ts --bundle --platform=node --format=cjs --target=node20 --outfile=dist/sea-main.cjs
node --experimental-sea-config sea-config.json
cp "$(command -v node)" dist/rowattest-gate
chmod u+w dist/rowattest-gate
if [ "$(uname -s)" = Darwin ]; then
  # A universal node binary holds the fuse sentinel once per architecture and postject refuses it; keep this machine's slice.
  if [ "$(lipo -archs dist/rowattest-gate | wc -w | tr -d ' ')" -gt 1 ]; then
    lipo -thin "$(uname -m)" dist/rowattest-gate -output dist/rowattest-gate.thin && mv dist/rowattest-gate.thin dist/rowattest-gate
  fi
  codesign --remove-signature dist/rowattest-gate
  npx --yes postject@1.0.0-alpha.6 dist/rowattest-gate NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA
  codesign --sign - dist/rowattest-gate
else
  npx --yes postject@1.0.0-alpha.6 dist/rowattest-gate NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
fi
ls -l dist/rowattest-gate
