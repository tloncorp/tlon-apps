#!/usr/bin/env bash
# Register Kernel as its own MCP server and install the browser skill on a local pier.
set -euo pipefail

[[ $# -eq 1 ]] || { echo "usage: browser.sh PIER < kernel-mcp.json" >&2; exit 2; }
pier=$1
script_dir=$(cd "$(dirname "$0")" && pwd)
skills_dir=$script_dir/../../skills

entry=$(jq -ce '
  select((.url | type) == "string")
  | {id: "kernel-browser", name: "Kernel Browser", url, headers: (.headers // []), enabled: true}
')
servers=$(printf '{}\n' | "$script_dir/acp-call.sh" "$pier" harness/mcp/servers)
printf '%s\n%s\n' "$servers" "$entry" |
  jq -cs '.[0] as $servers | .[1] as $browser
    | {servers: ([$servers[] | select(.id != $browser.id)] + [$browser])}' |
  "$script_dir/acp-call.sh" "$pier" harness/mcp/configure >/dev/null

catalog=$(printf '{}\n' | "$script_dir/acp-call.sh" "$pier" harness/skills)
install_skill() {
  local name=$1 description=$2 revision=''
  if jq -e --arg name "$name" 'any(.[]; .name == $name)' <<<"$catalog" >/dev/null; then
    revision=$(jq -nc --arg name "$name" '{$name}' |
      "$script_dir/acp-call.sh" "$pier" harness/skill | jq -er .revision)
  fi
  jq -nc --arg name "$name" --arg desc "$description" --arg revision "$revision" \
    --rawfile body "$skills_dir/$name.md" '{$name, $desc, $body, $revision}' |
    "$script_dir/acp-call.sh" "$pier" harness/skill/save >/dev/null
}

install_skill kernel-browser-secure-entry 'Kernel browser workflow for saved logins and private form fields.'
install_skill kernel-browser-payments 'Kernel browser workflow for checkout and payment approval.'
install_skill kernel-browser 'Use a real browser to navigate, inspect, and interact with websites.'

echo "Configured the Kernel Browser MCP server and skill."
