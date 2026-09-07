# Native actual-app scroller journey

Acceptance was declared before implementation on 2026-09-07. Actual normal
`App.main` Release preview checkpoints were exercised across retained attempts
r4–r8. The assembled reusable **18-message flow has not yet completed one
uninterrupted run**. This is actual application-path coverage, not
`ScrollStabilityFixture`, continuous geometry, or presented-frame evidence.

## Setup and boundaries

Use ordinary application flags, an explicitly selected iOS simulator, and the
wrapper-verified Release preview app. First verify the isolated local test-ship
identity and normal entry/bundle; then start on Home with no modal or keyboard.
This flow does not install, launch, log in, clear state, invite contacts, or delete
its group. Preserve the group and raw attempt output.

Required environment: `APP_ID=io.tlon.groups.preview`, unique `GROUP_NAME`, unique
ASCII `RUN_TAG` containing only letters/digits/hyphens, and a nonempty absolute
`SCROLLER_OUTPUT_DIR`. Screenshots are explicitly routed under that directory's
`captures` subtree. Reuse neither group name nor tag between complete runs.
An existing matching group on Home fails the precondition. Record ship identity,
app receipt/source snapshot and embedded bundle, UDID, configuration, orientation,
keyboard, and output directory. UI text alone does not establish server identity.

## Situation matrix and acceptance

| Situation | Required observable result |
| --- | --- |
| Create named conversation | Home → Add a chat → New group → Basic group. Before Next, exact group-name input appears between Name your group and Next. Create without inviting contacts; exact group title and Chat channel appear. |
| Eighteen channel sends | Send 18 distinct messages in declared order, alternating short, wrapping, and three-paragraph bodies. Every exact newline-bearing draft matches before send; input clears; every expected rendered paragraph appears in order within one Post, without a second matched Post or paragraph. Delivery indicator and exact failure/retry text must disappear within five seconds each; recheck content. |
| Composer growth | Message18 grows from one line to three while focused. Exact input checks and screenshots bracket one-line, expanded, and cleared states. This exercises growth/collapse without measuring height or intermediate motion. |
| Read older content | Hide keyboard at message18; latest control is absent. Two real UP searches, each bounded to five seconds, find message09 then message01. Every paragraph of message18 must be absent; the latest control must be visible. |
| Activate latest | Press the actual control; exact complete message18 appears once and the control is hidden. Control hiding alone does not prove a correct landing. |
| Enter thread | Long press the exact final parent Post, choose Reply. Require thread ScreenHeaderTitle Chat, MessageInput Reply, exact parent, and absent neighboring channel message17. |
| Reply and return | Send one exact two-line reply with the same input/content/duplicate/delivery checks. Back requires channel Chat text, MessageInput Message, no Reply composer, exact parent, 1 reply, and every reply paragraph absent. |
| Retained reentry | Press 1 reply within the exact parent Post. Require thread header/composer scope, exact parent and reply, and absent channel neighbor. Back repeats channel scope/content checks and hidden latest control. |

The 18-post setup and split search are declared adaptations of the retained
runs, not a measured guarantee that the native visibility threshold was crossed.
The predicate uses the native window height; absence of the final post alone
cannot prove eligibility. Keep the latest-control assertion as an ordinary
failure. Without distance/window evidence, a failed visibility assertion leaves
threshold qualification incomplete rather than establishing an application bug.

Required actions/assertions are never optional or gated on UI visibility.
Explicit waits and each scroll search are five seconds; implicit driver waits
use installed Maestro defaults. Do not retry, inject callbacks/navigation, write
scroll offsets, or catch failures as success. The two-search assembled route
still needs an uninterrupted device run.

## Actual native acquisition

Native header controls expose exact labels Add a chat and Back; their source
identifiers are not native accessibility IDs. Basic group's actual accessible
label combines title and description: `Basic group, Group with chat, gallery,
and notebook channels`. The template creates Chat, Gallery, and Notebook.
`MessageInput`, `MessageInputSendButton`, `ScrollToBottomButton`, and `Post` are
actual native IDs. Channel header Chat has no ScreenHeaderTitle ID in the retained
hierarchy; the thread has that ID but its title is also Chat. Composer state and
exact content distinguish scope. Do not assume the title is Thread: Chat.

GroupTitleInputSheet controls the input value but supplies no testID. Its exact
input-value assertion is bound between the name-sheet title and Next. A mismatch
fails before submission; it is not normalized or attributed to app/driver without
evidence.

The native hierarchy exposes each plain paragraph as a separate accessible text
with one terminal ASCII space. Preserve exact punctuation and interior whitespace;
never join the rendered paragraph selectors with newlines or trim arbitrary
whitespace. Draft input still requires the original complete newline-bearing
string. All expected paragraphs must share one production Post and appear in
vertical order. For this bounded one-to-three-paragraph corpus, three scope
patterns repeat endpoints for one/two-paragraph messages. Installed Maestro
filters verified these repeated matches. Maestro's normal deepest-match semantics
avoid treating identical parent/child AX representations as duplicate messages.

Duplicates mean no second matching accessible Post/paragraph at that checkpoint,
not a count of hidden, virtualized, or backend records. Expected paragraphs do
not exclude arbitrary additional nonmatching body content within that Post.
`StaticChatMessage` exposes ChatMessageDeliveryStatus for a nonfailed pending
state; `ChatMessageReplySummary` exposes Send failed, tap to retry. Their absence
with the exact body present is a sampled UI delivery checkpoint, not durable-write
proof or an exclusion of transient states between assertions.

## Execution and retained evidence

The verified device phase ran from 09:20:53 to 10:40:19 UTC on 2026-09-07:
**1h19m26s total**, **630s across eight Maestro attempts**, app-only time not
measured. The dedicated simulator was
`6DBBE7A7-F11A-4133-8B20-25A39B4B980C`; the unrelated simulator/account remained
untouched. Root verified normal App.main/index.tsx, Release preview, ordinary
flags, and both local account stores as self-hosted `~zod` at
`http://localhost:35453`. Final wrapper/bundle/account verification passed against
source snapshot `54dd5665951af376b66169f3cc160f340b3be07c762fd8538cc312f2854611f6`.
These results precede this adoption of the assembled flow.

| Attempt | Driver time | Retained result |
| --- | --- | --- |
| r1 | 23s | Setup failed on short Basic group label; actual native label includes description. |
| r2 | 58s | Messages1–2 exact UI checkpoints passed; message3 input/send/clear passed, then the joined-body AX assumption failed. |
| r3 | 21s | Group-name input discrepancy; created name differed from intended name. App versus driver cause remains unresolved. |
| r4 | 267s | Twelve exact sends and delivery checks, composer growth/clear, and real scroll to first content passed. Latest visibility failed with unqualified threshold setup. |
| r5 | 148s | Six additional exact sends/delivery checks passed. Five-second search timed out; retained hierarchy nevertheless showed original01 and latest control. This does not qualify that search or establish an app bug. |
| r6 | 29s | Latest visible/press/exact newest content/hidden control and actual thread entry passed. Assumed Thread: Chat title failed. |
| r7 | 51s | Exact reply send/content/delivery and Back passed; channel-only ScreenHeaderTitle ID assumption failed. |
| r8 | 33s | Corrected no-send channel return, retained thread reentry, and return checks passed. |

Independent backend readback confirmed exactly 18 declared channel posts plus one
correctly parented reply. Keep this separate from the UI-only delivery assertions.
The eight attempts do not constitute one successful uninterrupted journey.
Authoritative raw phase record is
`/private/tmp/scroller-native-product-r1-20260907/phase-result.json`; each attempt
retains its own report, commands, screenshots, and immutable flow manifest. Root's
final archive contains 450 files / 37,486,604 bytes, SHA256
`013b1a4e3da5334fa39aeff65117a210fe6ef1514bbc0cf79bc74adb7ea9965a`.

## Run after wrapper verification and isolated login

Set an explicit simulator UDID, unique run tag, and absolute output directory,
then from the intended checkout:

```sh
/Users/danielbrewster/.codex/bin/tlon-mobile-run inspect
/Users/danielbrewster/.codex/bin/tlon-mobile-run maestro --udid "$SCROLLER_UDID" -- test \
  -e APP_ID=io.tlon.groups.preview \
  -e GROUP_NAME="Scroll-$SCROLLER_RUN_TAG" \
  -e RUN_TAG="$SCROLLER_RUN_TAG" \
  -e SCROLLER_OUTPUT_DIR="$SCROLLER_OUTPUT_DIR" \
  --test-output-dir "$SCROLLER_OUTPUT_DIR" \
  --debug-output "$SCROLLER_OUTPUT_DIR/debug" \
  --format junit --output "$SCROLLER_OUTPUT_DIR/report.xml" \
  .maestro/scroller-product.yaml
```

Execute this file explicitly, not the disabled repository-wide legacy flow list.
A selector or acquisition failure remains an ordinary failed attempt and incomplete
product coverage; only completed assertions support checkpoint claims. Installed
Maestro parser and corpus controls validate the adopted harness separately from
runtime evidence. The adopted root parsed 87 commands; corpus controls passed
18 messages plus one reply, exact input/paragraph matching, required output-path
validation, and unchanged strict assertion helpers. There is no acceptance
threshold on total Maestro run time.

## Remaining dimensions

Still unproved here: continuous no-jank, first-visible-frame or exact-pixel landing,
flicker, frame presentation, durable read/unread state, attachments/media decode,
thinking indicators, pending-request cancellation, incoming-content concurrency,
offline/reconnect, background/resume, accessibility scaling, and long-history
pagination. These require their own qualified scenarios and measurements.
Mobile web remains excluded.
