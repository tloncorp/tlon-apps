set -euo pipefail
npm install -g @openai/codex@0.145.0
node ../../scripts/agent-qa/install-video-tools.mjs
curl --fail --location --retry 2 https://github.com/cli/cli/releases/download/v2.99.0/gh_2.99.0_linux_amd64.tar.gz -o /tmp/gh.tar.gz
echo 'ed4960225d2833e04a61590d9fa2b5773d147f3aa375459e5466a40c102f3832  /tmp/gh.tar.gz' | sha256sum --check
tar -xzf /tmp/gh.tar.gz -C /tmp
