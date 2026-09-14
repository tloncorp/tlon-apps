# Bot message journey observability

This instrumentation traces bot messages across `%steward`, the bot moon,
and the OpenClaw Tlon plugin. Events contain routing metadata and message
correlation keys; they contain no message or reply text.

The stateless journey observer in `%steward` watches local `%chat /v4` and
`%channels /v4` feeds. It emits events only for profiles with a valid
[`bot-info`](../../../docs/bot-info.md) claim identifying the `openclaw` harness.
It reads the child bot's contact on an owner ship, the self-contact on a bot
ship, and the author's contact for channel messages. An unavailable `%contacts`
agent, missing contact, or invalid claim emits nothing. This is the same
best-effort profile check for DMs and channels. Once ordinary contact peering
has delivered the profile, later messages can emit events. The observer does
not fetch profiles or backfill messages skipped before the profile arrived.

Bot identity and ownership come from separate sources. The published
`bot-info` claim contains the harness and versions, not the configured owner.
Bot-side DM events use `%steward`'s configured `owner`. Owner-side DM events
cover sponsored bots. Group-host events attribute the bot to its sponsor,
matching the usual hosted configuration; they use the locally available bot
profile as eligibility evidence. The additional owner-replica event exists
when that sponsor has the channel locally. These observations are best effort:
they do not establish a delegated-owner relationship when configuration
differs from sponsorship.

Context Lens is independent of this instrumentation. Input stages join on the
inbound message ID; output stages join on the outgoing correlation key.

## Event contract

Schema version: `1`.

| Event | Producer | Correlation | Meaning |
| --- | --- | --- | --- |
| `owner_message_sent` | owner `%steward` journey module | `input_message_id` | The owner's local DM write was reduced for a child moon marked as an OpenClaw bot. |
| `bot_message_received` | moon `%steward` journey module | `input_message_id` | The bot's local chat feed observed a DM from its configured owner. |
| `plugin_input_observed` | OpenClaw Tlon monitor | `input_message_id` | The DM subscription delivered the message to the plugin. |
| `plugin_input_selected` | OpenClaw Tlon monitor | `input_message_id` | The plugin accepted the message for processing. |
| `turn_started` | OpenClaw turn recorder | `input_message_id`, `run_id` | OpenClaw began a turn for the message. |
| `tlon.agent_turn.terminal` | OpenClaw turn recorder | `input_message_id`, `run_id` | The turn ended, with `dispatch` set to `attempted`, `skipped`, or `not_applicable`. |
| `reply_dispatch_attempted` | OpenClaw turn recorder | `input_message_id`, `run_id`, `attempt_number` | A Tlon reply transport call began, after local validation, setup, and authentication. There can be multiple attempts per turn. |
| `reply_dispatch_failed` | OpenClaw turn recorder | `input_message_id`, `run_id`, `attempt_number` | A Tlon reply transport call failed. |
| `moon_reply_enqueued` | OpenClaw turn recorder | `input_message_id`, `run_id`, `output_message_id` | The local API accepted the send. `output_message_id` is the sender correlation key; acceptance does not confirm remote delivery. |
| `bot_message_sent` | moon `%steward` journey module | `output_message_id` | The bot's local chat feed observed its own DM to its configured owner. This records a local write, not a remote acknowledgement. |
| `owner_message_received` | owner `%steward` journey module | `output_message_id` | The owner observed a remote reply from a child moon marked as an OpenClaw bot. |
| `group_host_message_received` | group host `%steward` journey module | `output_message_id` | The group host's channel feed observed a new chat/gallery post or reply authored by a marked bot. |
| `owner_group_message_received` | owner `%steward` journey module | `output_message_id` | The bot's sponsor observed the new chat/gallery post or reply in its local channel replica. |

## Correlation and coverage

Ship attributes use canonical `~ship` form. Dispatch events use the actual
outbound target kind (`dm`, `group_channel`, or `notebook`), which can differ
from the turn's inbound destination.

For DMs, the plugin and backend share the canonical `author/timestamp` message
ID. For channel posts and replies, the host assigns the stored ID after the
send. The plugin does not receive that ID from the poke acknowledgement.
Instead, both producers emit `author/sent` as `output_message_id`, using the
sender timestamp carried in the post or reply. It is a correlation key, not a
host message address. The join assumes each send by a bot has a distinct
millisecond timestamp; simultaneous sends with the same timestamp are
ambiguous.

Backend channel events cover new chat and gallery posts and replies (revision
zero). Edits, deletions, and reactions emit no events. Legacy diary channels
and Notes notebooks have no backend journey stages, even when their sends
produce plugin dispatch events. When the owner is also the group host, both
channel stages are emitted. Group input coverage begins when the plugin
selects a message; there is no backend stage that predicts whether a bot
should reply to every channel message.

## Loki correlation example

The following DM example finds bot-side sends at least 30 minutes old with
no matching owner receipt in a bounded lookback. It describes a query, not an
installed alert rule. The `{exporter="OTLP"}` selector and JSON attribute paths
are examples; the deployed exporter determines the actual stream labels and
field paths.

The first expression counts eligible bot-side sends:

```logql
sum by (output_message_id) (
  count_over_time(
    {exporter="OTLP"}
      |= "tlon.message_journey.bot_message_sent"
      | json stage=`attributes["tlon.message_journey.event"]`, output_message_id=`attributes["tlon.message_journey.output_message_id"]`, destination_kind=`attributes["tlon.message_journey.destination_kind"]`
      | stage="bot_message_sent"
      | destination_kind="dm"
      | output_message_id!=""
      | __error__=""
    [24h] offset 30m
  )
)
```

The second expression counts owner receipts:

```logql
sum by (output_message_id) (
  count_over_time(
    {exporter="OTLP"}
      |= "tlon.message_journey.owner_message_received"
      | json stage=`attributes["tlon.message_journey.event"]`, output_message_id=`attributes["tlon.message_journey.output_message_id"]`
      | stage="owner_message_received"
      | output_message_id!=""
      | __error__=""
    [24h30m]
  )
)
```

If those expressions are `A` and `B`, the missing-reply expression is:

```logql
A unless on(output_message_id) B
```

`A` and `B` are shorthand for the two LogQL subexpressions, not Grafana query
reference IDs. The full query places them on either side of `unless`. An
aggregate `sum(A unless on(output_message_id) B) or vector(0)` gives the count
of missing receipts; the unaggregated expression retains the output IDs.
The lookback bounds query cost and detection history.

Earlier DM boundaries join `owner_message_sent` to `bot_message_received` on
`input_message_id`, and `moon_reply_enqueued` to `bot_message_sent` on
`output_message_id`. Plugin selection joins to `turn_started` on
`input_message_id`.

For supported channel outputs, `moon_reply_enqueued` joins to
`group_host_message_received` on the sender `output_message_id`. The host is
authoritative for the channel. `owner_group_message_received` is an additional
replica check only where the sponsor is expected to have the channel locally.
