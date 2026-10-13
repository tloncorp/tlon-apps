#!/usr/bin/env bash
set -euo pipefail
npm install -g @openai/codex@0.145.0
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) asset=gh_2.99.0_macOS_arm64.zip; digest=94d4bd7e88563a9cb414e651e88acc4f1728a87476752460906d824230748d37 ;;
  Darwin-x86_64) asset=gh_2.99.0_macOS_amd64.zip; digest=70c05750c75df9465bc73b994e8bc379243bb494271f1b51f54ead2e19e45471 ;;
  Linux-x86_64) asset=gh_2.99.0_linux_amd64.tar.gz; digest=ed4960225d2833e04a61590d9fa2b5773d147f3aa375459e5466a40c102f3832 ;;
  *) exit 1 ;;
esac
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
curl -fsSL --retry 2 "https://github.com/cli/cli/releases/download/v2.99.0/$asset" -o "$dir/$asset"
(cd "$dir" && echo "$digest  $asset" | shasum -a 256 --check)
if [[ "$asset" == *.zip ]]; then unzip -q "$dir/$asset" -d "$dir"; else tar -xzf "$dir/$asset" -C "$dir"; fi
sudo install -m 755 "$(find "$dir" -type f -name gh | head -1)" /usr/local/bin/gh
if [ "${1:-}" = review ]; then
  npm install -g agent-device@0.21.5
  if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then brew install ffmpeg; fi
fi
