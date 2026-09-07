# Native entry landing and manual interaction baseline

Total phase time was **23 minutes 21 seconds**, from 08:44:27 to final installed
snapshot verification at 09:07:48 UTC. This includes build, desktop-capture
coordination, interaction and analysis. The seven selected captures contain
**26.92 seconds** of native observation, separately recorded in
`/private/tmp/scroller-native-entry-phase-timing-20260907.json`.
The first keyboard attempt missed its action window and remains incomplete.

These are Release iOS **component-fixture** results. They run the real Scroller,
PostList, message rendering and composer, with fixture data and substituted
application callbacks. They do not qualify normal-app navigation, backend sends,
durable reads, physical presentation, or every content type.

## Entry results

The [entry contract](scroller-native-buffer-evidence-contract.md) was declared
before execution: fixed content and target identity, an independently specified
2,800 ms readiness deadline, 1,000 ms tail, and a 1 pt landing tolerance. Native
action markers and actual destination ownership/content revisions associate
the recording with the requested entry. First readable content and every later
observed frame are checked, including any initial wrong landing that recovers.

| Entry | Independent row-model result | Observation |
| --- | --- | --- |
| Latest | PASS | 0 pt maximum error; 200 content frames and 60 tail frames |
| Selected post 65 | FAIL | 24.167 pt below the usable viewport center from first reveal through the entire tail; 210 content frames and 60 tail frames |
| Delayed content | PASS | 0.333 pt maximum error; 49 empty destination frames before data, then 173 content frames |

All three native acquisitions are complete. The selected target's center was
485.667 pt; the usable viewport ran from 203 to 720 pt, with center 461.5 pt.
This is a persistent landing discrepancy within the accepted component contract,
not an inference from a screenshot. The latest entry's URL driver also performs
an accessibility read and screenshot during capture; the other two entries use
a batched action with the driver's final inspection after capture.

JavaScript collector results remain separately incomplete. Auxiliary native
qualification does not rewrite them. Native view geometry and CADisplayLink
callbacks do not establish presented pixels or input-to-usable-layout latency.

## Installed source and retained evidence

- Checkout: `/Users/danielbrewster/Projects/landscape-apps`, branch
  `db/scroll-stability-fixture`, base `0084cc91f64472848a4e6c75da4256e13d642819`.
- Dirty snapshot:
  `4c8ca7b484515d9eea11a0f02ddb2de64d5de25229d2dc034aeffcf9cff91727`.
- iPhone 17 Pro, iOS 26.4, simulator
  `47BA41EE-F11D-4FA3-A8A1-B1400A511A96`; Release preview fixture entry.
- Native executable SHA-256:
  `8e374df01100221509d6ae21c3a2cfd58dd2613010eb304fbd4be17e8613f782`.
- Installed and built `main.jsbundle` both contain 31,104,285 bytes with SHA-256
  `6ed314e2208729ab4366eb7b2eeb1d16f581d4674f36cde4221e3f23f3c844fe`.

The required wrapper built, installed, launched and finally verified the frozen
snapshot. Supplemental JavaScript-bundle verification is retained because a
different entry point can change JavaScript without changing the executable.

Independent results and details:

- `/private/tmp/scroller-native-entry-independent-replay-20260907.json`
- `/private/tmp/scroller-native-entry-independent-acquisition-20260907.json`
- `/private/tmp/scroller-native-entry-independent-details-20260907.json`
- `/private/tmp/scroller-native-entry-bundle-verification-20260907-r1.json`
- `/private/tmp/scroller-native-entry-final-verify-20260907-r1.txt`

Raw recordings are under `/private/tmp/tlon-scroll-stability/entry-*-20260907`.
The three entry cases share one batch run ID; copies of earlier batch recordings
in later collection directories are not additional runs. The source archive
`artifacts/scroller-source-2026-09-07-entry.tgz` has SHA-256
`a9c0ba165681a123a5f7879ac80ce2147f4db6e3e0849f02925f394a54837845`.

## Manual interaction evidence

Corrected keyboard opening, short complete three-line typing, keyboard dismissal
while reading history, and a real 800 ms vertical gesture were captured. The
typing trace contains every input through `Alpha\nBeta\nGamma` and more than
three seconds of recorded tail after the final input. Composer layout records
the growth from 78.333 to 97.333 pt. This closes the prior driver's truncated
typing sequence, not the entire native input acceptance contract.

The first keyboard attempt armed a 4.5-second capture but sent the tap after it
ended. The corrected driver waits for the recording status and sends its action
in one batched invocation. Original failed and incomplete attempts are retained;
manual native acquisitions and product-scope assertions require their own
independent replay. No manual product pass is inferred from successful capture.

Independent manual replay is now retained in
`/private/tmp/scroller-native-entry-manual-independent-20260907.json`:

| Manual case | Native acquisition | Product qualification |
| --- | --- | --- |
| Corrected keyboard opening | INCOMPLETE: 256.480 ms observation gap | INCOMPLETE |
| Complete three-line composer growth | INCOMPLETE: 139.157 and 263.070 ms gaps | INCOMPLETE |
| Keyboard dismissal in history | COMPLETE | INCOMPLETE |
| Actual vertical gesture | COMPLETE | INCOMPLETE |

The original JavaScript path loses coherent acquisition in all four cases;
dismissal also lacks valid original baseline guards. The native buffer currently
has no ordinary-scenario product evaluator that could replace those checks.
Observed actions and complete terminal tails do not fill that missing gate.
The first keyboard driver's acquisition is complete but it contains no keyboard
action, so it separately remains product-incomplete. Native entry qualification
above uses its own independently calibrated entry evaluator.

The retained evidence supplement is
`artifacts/scroller-baseline-2026-09-07-entry-and-built-web.tgz`, with 213 verified
files and SHA-256
`1e960b69bbe384c7111dfbdf9ca14e9fbcc39d897ab707cc5393bc87b28545f3`.
It preserves raw incomplete attempts and independent replays. Its source copy
is an archive-time snapshot; the original frozen source archive above and each
run receipt remain the authority for source used during execution.
