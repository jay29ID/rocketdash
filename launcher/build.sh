#!/usr/bin/env bash
# Builds RLStats.exe with every file in ../recorder embedded.
# Usage: launcher/build.sh <path to upload.json> [output.exe]
# upload.json holds the upload key, so it is passed in rather than kept in the repo.
# Needs the Mono C# compiler (mcs); the exe runs on Windows' built-in .NET Framework 4.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
upload="${1:?path to upload.json}"
out="${2:-$here/RLStats.exe}"
stamp="$(cat "$here/RLStats.cs" "$upload" "$here"/../recorder/* | sha256sum | cut -c1-16)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
printf '%s' "$stamp" > "$tmp/build-stamp.txt"
res=(-resource:"$tmp/build-stamp.txt",build-stamp.txt -resource:"$upload",upload.json)
for f in "$here"/../recorder/*; do res+=(-resource:"$f","app/$(basename "$f")"); done
mcs -nologo -target:winexe -optimize+ -platform:anycpu -out:"$out" "${res[@]}" "$here/RLStats.cs"
echo "built $out (stamp $stamp)"
