# OpenClaw fixtures

`openclaw-2026.5.28-cron-jobs.sanitized.json` contains sanitized job objects captured from successful cron tool results in the pinned OpenClaw `2026.5.28` development container. The `at` and `every` jobs came from session file `c87e8f5e-1a0c-4866-b967-5c3f44311ca7.jsonl`, jobs `0634ad7a-3ba1-4a65-b64a-db04658d8e64` and `f8a8741a-af0f-4cf1-8da9-43faf429cc7b`. The `cron` job came from a live pinned-runtime CLI capture; both `cron add` and `cron get` returned the same job shape.

Names, IDs, message text, and delivery recipients were replaced. Field presence, schedule and timestamp values, delivery shapes, and runtime state shapes were retained. The fixture contains no tokens, secrets, or session keys.
