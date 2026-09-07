# Buffered iOS recording baseline

This run validates acquisition by the native recorder added under the
[predeclared contract](scroller-native-buffer-evidence-contract.md). It does not
replace the original geometry or product qualification. No production scrolling
behavior was changed.

The phase took **14 minutes 27 seconds**, from 07:27:57 to final verification at
07:42:24 UTC. The 42 selected scenario recordings contain **94.36 seconds** of
native observation windows; that is recorded app time, not total interaction or
build time. An additional append-history smoke recording is retained separately
and does not increase the variant count.

## Installed snapshot

- Checkout: `/Users/danielbrewster/Projects/landscape-apps`.
- Branch: `db/scroll-stability-fixture`; base commit:
  `0084cc91f64472848a4e6c75da4256e13d642819`.
- Dirty snapshot:
  `b55e2b23a984389980df407981d4e236783fc17d1c3e129adebd2dc93cc43491`.
- Target: iPhone 17 Pro, iOS 26.4,
  `47BA41EE-F11D-4FA3-A8A1-B1400A511A96`.
- Configuration: Release preview, dedicated scroller fixture entry point.
- Executable SHA-256:
  `dd4b95b7cb2e8f8cb14d9ebf4ea0b7bea03f7ebee9bbea42b3f62deb2e4478d3`.

The required wrapper built, installed and launched this exact snapshot. Its
install verification compared the simulator executable with the artifact; final
verification passed before source edits resumed. Receipts and logs:

- `/private/tmp/scroller-native-buffer-inspect-20260907.txt`
- `/private/tmp/scroller-native-buffer-build-20260907.log`
- `/private/tmp/scroller-native-buffer-receipt-20260907.tsv`
- `/private/tmp/scroller-native-buffer-final-verify-20260907.txt`

## Acquisition results

| Selected recordings | Result | Remaining limit |
| --- | --- | --- |
| 35 ordinary core cases | Continuous native geometry and row metadata acquired | These are acquisition-complete, not product passes; action and semantic assertions remain separate |
| Three entry cases | Incomplete | Recorder binds the outgoing root; replacing that root loses ownership and metadata |
| Composer growth, keyboard dismissal, actual swipe | Continuous native acquisition | The composer typing command continued beyond the fixed capture; it does not prove the whole draft sequence or its terminal tail |
| Keyboard opening at latest | Incomplete | Largest observation gap 191.18 ms; recording lasted 4,182.15 ms against a 4,375 ms minimum |

Thus 38 of 42 selected recordings have complete acquisition and four do not.
All observed native operations were nonoverlapping. The smoke recording
contained 110 frames, at most 19.08 ms between completed observations and at most
2.24 ms per measurement. Actual native accessibility metadata contained the
declared scope, row identity and content/reaction/reply fingerprints.

The old JavaScript collector remains present in these raw files. Its failures
and incomplete captures were not cleared by adding a successful auxiliary
recording. In particular, the native buffer's parent input-key metadata is not
proof of the virtualizer's committed internal membership. Native view model
geometry and CADisplayLink callbacks are not presented-frame or text-pixel proof.

Raw selected traces are in `/private/tmp/tlon-scroll-stability/`, in
`buffer-core-20260907` and the four `buffer-{keyboard,composer,dismiss,gesture}-20260907`
directories. The separate smoke is in `buffer-smoke-20260907`.

## Independent replay correction

Review found two timing holes in the initial acquisition oracle: it bounded the
idle time between reads instead of the distance between emitted observations,
and allowed overlapping synchronous reads. For example, 24 ms reads separated
by 124 ms idle time produce observations 148 ms apart and must be incomplete.
The required-row visibility side channel also needed to intersect the usable
viewport above the composer.

Those replay checks were corrected after final installed-snapshot verification;
94 focused native acquisition/geometry controls passed. Original recordings and
their producer assessments remain unchanged. Replay source hashes must accompany
derived results, separately from the installed snapshot above. The actual
recordings' completed-observation gaps and operation order were also directly
checked; the keyboard gap remains incomplete under either oracle.

Corrected acquisition replay, including installed and replay source identities:
`/private/tmp/scroller-native-buffer-corrected-replay-20260907.json`.
Independent qualification using only the retained original JavaScript collector
is separately saved in
`/private/tmp/scroller-native-buffer-legacy-qualified-20260907.json`: nine
recorded sampled passes, nine failures and 24 incomplete cases at the raw oracle
layer. The shared product-scope qualifier additionally rejects `near-cache`:
programmatic positioning does not establish deliberate READ inside the follow
threshold. That replay is
`/private/tmp/scroller-native-buffer-scope-qualified-20260907.json` and records
**nine sampled passes, eight failures and 25 incomplete cases**. The original
raw `near-cache` geometry and failed producer verdict remain retained. These counts
describe a different evidence path and must not be combined with the 38 complete
auxiliary acquisitions into a larger pass count.

The next work is explicit root-transition ownership, a native capture window
that starts after acquisition is established, complete interaction tails, and
independent action/semantic association before buffered geometry can qualify
whole scenarios. Whole native read/send/navigation journeys remain required.
