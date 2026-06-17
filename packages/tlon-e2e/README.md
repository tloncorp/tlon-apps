# Tlon E2E Coverage Matrix

This directory tracks abstract Tlon E2E scenarios across platform harnesses.
It does not run the harnesses; it checks which scenarios each harness claims to
cover.

The scenario catalog lives in `scenarios.json`. Each scenario lists the
platforms that should eventually cover it and the suite group it belongs to.
Groups map to the intended test files (`00-connectivity`, `01-messages`, etc.)
so the report can show missing Hermes coverage next to the file where it should
probably land.

Tests opt into scenarios with comments:

```ts
// @tlon-e2e openclaw: dm.basic_reply, channel.post_message
// @tlon-e2e hermes: dm.basic_reply
```

Run the report:

```sh
pnpm tlon:e2e:coverage
```

Run the CI check:

```sh
pnpm tlon:e2e:coverage:check
```

Report mode exits successfully even when desired coverage is missing, which is
useful while Hermes is catching up. Check mode exits non-zero for missing
desired coverage, unknown platforms, or unknown scenario tags.
