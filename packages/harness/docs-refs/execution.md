# JavaScript execution

## Enable the tool

Enable **Run JavaScript** in Settings → Conversation → Tools and save.
The bundled `run_js` tool requires the opt-in `%code` grant. Example:

```js
module.exports = () => JSON.stringify({ answer: 6 * 7 });
```

The host APIs include `fetch_sync`, `console.*` and
`require('urbit_thread')` for file I/O, sleep and ship integrations.
This is broad authority: other tool grants do not restrict those host APIs.
Tlon conversations can use an explicit `%code` grant. The configured owner's
conversation settings apply directly; other senders also need the grant in
their Tlon permissions. Scheduled work and rehearsals cannot use `%code`.
Owner-session subagents can inherit it within their parent's current grants.
**Known bug:** `%code` doesn't limit owner conversations, which can run `run_js` and
pass it to subagents without the grant. See [known bugs](../ISSUES.md#known-bugs).
Do not enable it for untrusted work. Beyond the static loop check and the
yielding watchdog, a per-conversation CPU-time limit (a `%jinx` hint around the
WASM engine steps) bails runaway pure computation; it is not a security sandbox.

`desk/lib/thread-builder-js.hoon` runs the bundled QuickJS binary.
The assembled desk includes the WASM/strand libraries; no
external executor application is required. The distribution test
checks the binary and dependency presence. `tests-js/js-conformance.mjs` exercises
the real head, Spider and runtime with a deterministic local model and temporary
sessions, including rejection, results, errors, cancellation and the watchdog.

## Responsibilities

The head authorizes the call, the executor runs it, and the head records the
result if the call is still outstanding and permitted.

QuickJS executes a WASM binary through `thread-builder-js`. WASM and strand
libraries provide resumable I/O; host functions bridge JavaScript to Urbit
operations. Matching runtime jets and Hoon dependencies affect performance.

The source contract assigns a function to `module.exports`; its return value
becomes the thread result. The thread-builder convention returns
`[%0 (each result=cord [err=cord where=cord])]` inside a vase. Structured results
should be explicitly encoded rather than relying on implicit string conversion.

## Harness boundary

Harness dispatches JavaScript through Spider and tracks the thread identity for
cancellation. The composition root owns timeout and result admission; effect
bindings construct the execution cards. See
[the head](../desk/app/harness.hoon) and
[effect bindings](../desk/lib/harness-effects.hoon).

The lifecycle is:

1. Check the conversation's tool grant and record the requested call.
2. Dispatch the executor with an identity scoped to the outstanding work.
3. Schedule a watchdog independently of the executor.
4. On success or failure, accept a result only while that call is authorized and
   outstanding, then record its terminal receipt.
5. On cancellation or timeout, withdraw the thread where possible and fence any
   late result. Cancellation cannot undo an external action already performed.

## Dependency and authoring discipline

Stage the executor's dependency closure through the desk build. Use compatible
strand, strandio, Spider and WASM types; do not infer compatibility from a desk's
declared Kelvin alone. A dependency update requires compilation and execution
checks against the supported runtime.

A minimal thread-builder entry point has this shape:

```hoon
/-  spider
/+  tbjs=thread-builder-js
=*  strand  strand:spider
^-  thread:spider
|=  arg=vase
=+  !<([~ code=@t] arg)
(tbjs code ~s30)  ::  second arg is the @dr CPU-time (jinx) bound; 0 = no limit
```

Host functions determine what scripts can access. Treat additions that poke,
fetch, or write as permission changes; prompt instructions do not restrict them.

## Execution limits

- I/O yields to other events; the watchdog and Spider stop bound those hangs.
  Pure computation runs as one uninterrupted event, so it is instead bounded by
  the per-conversation CPU-time limit — a `%jinx` hint that arms a SIGVTALRM
  timer and bails the computation on expiry. Set the limit to 0 for no bound.
  This is a liveness guard, not hard CPU isolation or a security boundary.
- Timeouts end abandoned I/O waits and reject late results.
- Use short scripts; long loops and retained executor history can grow memory.
- Measure cold starts, warm runs, code changes, and restarts separately.
- Use native capabilities for on-ship operations rather than self-HTTP.
- The runtime does not provide Node.js or npm.

## Verification

Use disposable test ships and uniquely named fixtures. Check a constant return,
structured output, syntax/runtime errors, permitted HTTP and Clay operations,
cancellation during I/O, timeout, late-result rejection, and continuation of the
conversation afterward.

Measure provider-independent executor latency and maximum individual-event
runtime separately from HTTP/client transport delay. Record the runtime version,
source revisions and workload with benchmark results. Do not present a warm-cache
microbenchmark as a general responsiveness guarantee.

Do not use an unbounded compute loop to test cancellation on a shared ship.
Evaluate hard execution limits in an isolated environment before granting such
an executor to untrusted callers.
