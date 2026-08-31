# Bot message journey observability

This instrumentation traces a hosted bot DM from the owner's backend, through
the bot moon and OpenClaw, and back to the owner's backend. For group replies,
it also confirms persistence at the group host and, when the owner has the
channel locally, at the bot moon's owner. It is content-free: event attributes
contain routing metadata and canonical message IDs, but never message or reply
text.

The stateless `journey` module in the `%steward` Gall agent subscribes to the
local `%chat` v4 and `%channels` v4 feeds and synchronously reads `%contacts`
for candidate messages. It emits a stage only when the relevant profile
already has a `bot-info` text field whose JSON says
`"harness":"openclaw"`. On an owner ship, that is the child moon's profile; on
a bot moon receiving owner input or persisting its own reply, it is the moon's
self-profile. For a group persistence event, it is the message author's
profile. A missing marker, malformed marker, or any other harness emits
nothing, so human messages never enter the bot delivery alert population. This
intentionally assumes the contact is already present; the observer stores no
pending state and performs no retry.

Context Lens is not part of the correlation contract. The inbound Tlon message
ID joins the input stages and OpenClaw turn; the outbound Tlon message ID joins
OpenClaw's successful send with owner-side persistence.

## Event contract

Schema version: `1`.

| Event | Producer | Correlation | Meaning |
| --- | --- | --- | --- |
| `owner_input_accepted` | owner `%steward` journey module | `input_message_id` | The owner's local DM write was reduced for a child moon marked as an OpenClaw bot. |
| `moon_input_persisted` | moon `%steward` journey module | `input_message_id` | The marked OpenClaw moon reduced the remote DM from its owner. |
| `plugin_input_observed` | OpenClaw Tlon monitor | `input_message_id` | The DM subscription delivered the message to the plugin. |
| `plugin_input_selected` | OpenClaw Tlon monitor | `input_message_id` | The plugin accepted the message for processing. |
| `turn_started` | OpenClaw turn recorder | `input_message_id`, `run_id` | OpenClaw began a turn for the message. |
| `tlon.agent_turn.terminal` | OpenClaw turn recorder | `input_message_id`, `run_id` | The turn ended, with `dispatch` set to `attempted`, `skipped`, or `not_applicable`. |
| `reply_dispatch_attempted` | OpenClaw turn recorder | `input_message_id`, `run_id`, `attempt_number` | A Tlon reply transport call began, after local validation, setup, and authentication. There can be multiple attempts per turn. |
| `reply_dispatch_failed` | OpenClaw turn recorder | `input_message_id`, `run_id`, `attempt_number` | A Tlon reply transport call failed. |
| `moon_reply_enqueued` | OpenClaw turn recorder | `input_message_id`, `run_id`, `output_message_id` | The moon API accepted the outgoing message and returned its canonical ID. This is not proof of owner delivery. |
| `moon_reply_persisted` | moon `%steward` journey module | `output_message_id` | The marked OpenClaw moon's `%chat` feed observed its locally authored DM reply to its owner. |
| `owner_reply_persisted` | owner `%steward` journey module | `output_message_id` | The owner observed a remote reply from a child moon marked as an OpenClaw bot. |
| `group_host_reply_persisted` | group host `%steward` journey module | `output_message_id` | The group host's `%channels` feed observed a top-level post or reply authored by a moon marked as an OpenClaw bot. |
| `owner_group_reply_persisted` | owner `%steward` journey module | `output_message_id` | The bot moon's owner observed that OpenClaw-authored post or reply in its local `%channels` replica. This stage exists only when the owner has the channel locally. |

Dispatch events use the actual outbound target kind (`dm`, `group_channel`, or
`notebook`), which can differ from the turn's inbound destination. Group posts
and replies use their canonical `author/id` as `output_message_id`, matching the
ID returned to OpenClaw. If the owner is also the group host, `%steward` emits
both group persistence stages. Edits, reactions, and notebook updates do not
emit these group stages.

## Grafana alert

Use a Grafana-managed alert backed by Loki rather than an in-process timer. An
in-process timer is lost on restart and creates a second timeout state machine.
Evaluate every five minutes and alert when a moon-persisted DM reply at least
30 minutes old has no matching owner persistence event. Starting at the
independently observed moon stage keeps the moon-to-owner alert separate from
the plugin-to-moon boundary.

First, count eligible moon-persisted replies. Hoon sends the
`tlon.message_journey.*` attributes directly:

```logql
sum by (output_message_id) (
  count_over_time(
    {exporter="OTLP"}
      |= "tlon.message_journey.moon_reply_persisted"
      | json stage=`attributes["tlon.message_journey.event"]`, output_message_id=`attributes["tlon.message_journey.output_message_id"]`, destination_kind=`attributes["tlon.message_journey.destination_kind"]`
      | stage="moon_reply_persisted"
      | destination_kind="dm"
      | output_message_id!=""
      | __error__=""
    [24h] offset 30m
  )
)
```

Then count owner acknowledgements. Hoon sends the `tlon.message_journey.*`
attributes directly, without the gateway prefix:

```logql
sum by (output_message_id) (
  count_over_time(
    {exporter="OTLP"}
      |= "tlon.message_journey.owner_reply_persisted"
      | json stage=`attributes["tlon.message_journey.event"]`, output_message_id=`attributes["tlon.message_journey.output_message_id"]`
      | stage="owner_reply_persisted"
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

`A` and `B` above are shorthand for the two LogQL subexpressions, not Grafana
query reference IDs. Configure the alert as one Loki query with the full first
expression on the left of `unless` and the full second expression on the right.

Use `sum(A unless on(output_message_id) B) or vector(0)` as the alert value and
fire when it is greater than zero for five minutes. Keep a separate dashboard
query with the unaggregated expression so responders can see the overdue output
IDs. The 24-hour lookback bounds query cost; it is incident detection, not a
durable retry queue.

Before enabling the rule, deploy the instrumentation to staging and inspect one
Hoon event to replace the broad `{exporter="OTLP"}` selector with its observed
`service_name` or other stable stream labels. Also verify the attribute paths,
because exporter changes can alter structured-field prefixes.

Earlier gaps can use the same pattern with deadlines appropriate to each
boundary: join `owner_input_accepted` to `moon_input_persisted`, or
`plugin_input_selected` to `turn_started`, on `input_message_id`; join
`moon_reply_enqueued` to `moon_reply_persisted` on `output_message_id`.

For group replies, join a `moon_reply_enqueued` event whose
`destination_kind` is `group_channel` to `group_host_reply_persisted` on
`output_message_id`. That is the primary backend-delivery check: the group host
is authoritative for the channel. `owner_group_reply_persisted` provides an
additional owner-side replica check, but should only drive a separate alert
where the owner is expected to have that channel locally.
