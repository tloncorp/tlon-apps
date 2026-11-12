#!/usr/bin/env bash
# Connect a model provider and make it the ship's default for new conversations.
#
#   scripts/harness/provider.sh PIER chatgpt [MODEL]
#   scripts/harness/provider.sh PIER openai|openrouter|anthropic|xai [MODEL]
#
# chatgpt signs in with a ChatGPT subscription through OpenAI's device login.
# The others ask for an API key on the terminal, or read it from stdin.
set -euo pipefail

[[ $# -ge 2 && $# -le 3 ]] || { sed -n 4,5p "$0" | sed 's/^# *//' >&2; exit 2; }
pier=$1 provider=$2 model=${3:-}
call() { "$(dirname "$0")/acp-call.sh" "$pier" "$1"; }

case $provider in
  chatgpt)    url=https://chatgpt.com/backend-api/codex/responses     default=gpt-6-luna slot=openai-device ;;
  openai)     url=https://api.openai.com/v1/responses                 default=gpt-6-luna slot=openai ;;
  openrouter) url=https://openrouter.ai/api/v1/chat/completions       default=z-ai/glm-5.3-flash slot=openrouter ;;
  anthropic)  url=https://api.anthropic.com/v1/messages               default=claude-haiku-4-5 slot=anthropic ;;
  xai)        url=https://api.x.ai/v1/chat/completions                default=grok-4.3 slot=xai ;;
  *) echo "unknown provider '$provider': use chatgpt, openai, openrouter, anthropic or xai" >&2; exit 2 ;;
esac

# Fail on a missing ship before asking anyone to sign in.
defaults=$(echo '{}' | call harness/defaults)

# POST stdin to URL with CONTENT-TYPE, setting $code and $body. Not in a pipeline:
# that would run it in a subshell and lose both.
request() {
  local response
  # --data drops the newline that <<< adds, which would corrupt the last field.
  response=$(curl -sS -m 30 -w '\n%{http_code}' -H "content-type: $2" --data @- "$1") || return 1
  code=${response##*$'\n'} body=${response%$'\n'*}
}

chatgpt_login() {
  local auth=${HARNESS_OPENAI_AUTH:-https://auth.openai.com}
  local client=app_EMoamEEZ73f0CkXaXp7hrann
  request "$auth/api/accounts/deviceauth/usercode" application/json <<<"{\"client_id\":\"$client\"}"
  [[ $code == 200 ]] || { echo "could not start ChatGPT login: HTTP $code" >&2; exit 1; }
  local device=$body
  local interval deadline=$((SECONDS + 900))
  interval=$(jq -r '.interval // 5 | tonumber | if . < 2 then 2 else . end' <<<"$device")

  echo "Open $auth/codex/device and enter this code:"
  echo "  $(jq -r '.user_code' <<<"$device")"
  echo "Waiting for approval..."

  while :; do
    (( SECONDS < deadline )) || { echo "the code expired; run this again" >&2; exit 1; }
    sleep "$interval"
    request "$auth/api/accounts/deviceauth/token" application/json \
      <<<"$(jq -c '{device_auth_id, user_code}' <<<"$device")" || continue
    [[ $code == 403 || $code == 404 ]] && continue
    [[ $code == 200 ]] || { echo "ChatGPT login failed: HTTP $code" >&2; exit 1; }
    break
  done

  local form
  form=$(jq -r --arg client "$client" --arg redirect "$auth/deviceauth/callback" '
    {grant_type: "authorization_code", code: .authorization_code, redirect_uri: $redirect,
     client_id: $client, code_verifier: .code_verifier}
    | to_entries | map("\(.key)=\(.value | @uri)") | join("&")' <<<"$body")
  request "$auth/oauth/token" application/x-www-form-urlencoded <<<"$form"
  [[ $code == 200 ]] || {
    echo "ChatGPT login failed exchanging the code: HTTP $code: $(jq -r '.error_description // .error // empty' <<<"$body" 2>/dev/null)" >&2
    exit 1
  }

  # The account id is a claim inside the token, and only the ship needs it.
  local claims
  claims=$(jq -r '.id_token // .access_token | split(".")[1]' <<<"$body" | tr '_-' '/+')
  while (( ${#claims} % 4 )); do claims+='='; done
  claims=$(base64 -d <<<"$claims" 2>/dev/null) || claims='{}'
  printf '%s\n%s\n' "$claims" "$body" | jq -cs '.[0] as $claims | .[1] | {
    provider: "openai-device",
    key: .access_token,
    refreshToken: (.refresh_token // ""),
    account: ($claims["https://api.openai.com/auth"].chatgpt_account_id // $claims.chatgpt_account_id // "")
  }' | call harness/credential/set >/dev/null
}

if [[ $provider == chatgpt ]]; then
  chatgpt_login
else
  if [[ -t 0 ]]; then
    read -rsp "$provider API key: " key
    echo
  else
    read -r key || true
  fi
  [[ -n $key ]] || { echo "no API key given" >&2; exit 1; }
  jq -Rc --arg provider "$slot" '{provider: $provider, key: .}' <<<"$key" |
    call harness/credential/set >/dev/null
  unset key
fi
echo "credential saved"

# A different route must not inherit the previous provider's model settings.
jq -c --arg url "$url" --arg model "$model" --arg default "$default" '
  (if .url == $url then . else . + {model: $default, headers: [], fallbacks: [], zdr: false} end)
  | .url = $url | .key = ""
  | if $model != "" then .model = $model else . end
  | {config: .}' <<<"$defaults" | call harness/defaults/configure |
  jq -r '"default for new conversations: \(.model) at \(.url)"'
