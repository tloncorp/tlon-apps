# AGENTS.md — Hermes Tlon adapter

The Hermes platform plugin for Tlon Messenger. See `README.md` for how it
reads (Eyre SSE), sends (the packaged `tlon` CLI) and dispatches, and for the
deliberate decisions recorded there (no reply-visibility handling, diary
migration). Keep behavior in parity with `packages/openclaw` unless the README
says otherwise.

## Code Review Rules

The root `AGENTS.md` rules apply, plus the deployment facts in
`packages/openclaw/AGENTS.md` "Code Review Rules": one harness and one account
per hosted bot, `%x` implicit in Eyre scry URLs, and peer content as the trust boundary.

-   Don't re-raise decisions the README records, unless you can show the
    recorded reason no longer holds (for example, the `hermes-agent` pin moved).
