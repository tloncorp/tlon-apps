# The weekly card

The week lives in the Kitchen as one interactive card — a post you author once per week and then **edit in place** as the household reacts. Never post a second card for the same week; a card trail is worse than no card.

## Shape

One Kitchen post. Its message text is your one-line note (assumptions, or what changed). Its `--blob` is a JSON array of exactly two entries joined by the same `surfaceId`:

1. an `a2ui` entry — the visible card (v0.9 messages: one `createSurface` with `catalogId` `tlon.a2ui.basic.v1`, one `updateComponents` with a flat component list referenced by id from `root`).
2. an `interactive-surface` entry — `surfaceId`, `revision` (0 on create, +1 per edit you make), and `state` (your own record of the week).

Limits that will reject the post if crossed: 50 components, depth 8, 12 children per container, 1000 chars per text node, 32KB per entry.

## Template

Copy this shape exactly; change only the meals, dates, ids, and the two places. `surfaceId` must be unique per card — use `weekly-plan-<week-start>` plus a short random suffix. In the footer's navigate target, `channelId` is the plans place's nest and `groupId` is the group flag (both are in the places legend above).

Do not simplify the structure. Every day is a `Row` holding a `Text` and a `Replace` `Button` — the buttons are how the household changes a night, so a card whose days are plain text rows is broken even though it renders. Keep all four components per day, all seven days.

```json
[
    {
        "type": "a2ui",
        "version": 1,
        "messages": [
            {
                "version": "v0.9",
                "createSurface": {
                    "surfaceId": "weekly-plan-2026-08-24-k3x9",
                    "catalogId": "tlon.a2ui.basic.v1"
                }
            },
            {
                "version": "v0.9",
                "updateComponents": {
                    "surfaceId": "weekly-plan-2026-08-24-k3x9",
                    "root": "card",
                    "components": [
                        { "id": "card", "component": "Card", "child": "col" },
                        { "id": "col", "component": "Column", "align": "stretch", "children": ["title", "meta", "row-mon", "row-tue", "row-wed", "row-thu", "row-fri", "row-sat", "row-sun", "div", "footer"] },
                        { "id": "title", "component": "Text", "text": "This week", "variant": "h4" },
                        { "id": "meta", "component": "Text", "text": "Assumes two people, no allergies · saved to Meal Plans", "variant": "caption" },
                        { "id": "row-mon", "component": "Row", "justify": "spaceBetween", "align": "center", "children": ["txt-mon", "btn-mon"] },
                        { "id": "txt-mon", "component": "Text", "text": "Mon · Tacos al pastor — 25 minutes", "weight": 1 },
                        { "id": "btn-mon", "component": "Button", "child": "btl-mon", "variant": "secondary", "action": { "event": { "name": "tlon.sendMessage", "context": { "text": "Replace Monday's dinner" } } } },
                        { "id": "btl-mon", "component": "Text", "text": "Replace", "variant": "caption" },
                        { "id": "row-tue", "component": "Row", "justify": "spaceBetween", "align": "center", "children": ["txt-tue", "btn-tue"] },
                        { "id": "txt-tue", "component": "Text", "text": "Tue · Coconut chickpea curry — uses the spinach", "weight": 1 },
                        { "id": "btn-tue", "component": "Button", "child": "btl-tue", "variant": "secondary", "action": { "event": { "name": "tlon.sendMessage", "context": { "text": "Replace Tuesday's dinner" } } } },
                        { "id": "btl-tue", "component": "Text", "text": "Replace", "variant": "caption" },
                        { "id": "row-wed", "component": "Row", "justify": "spaceBetween", "align": "center", "children": ["txt-wed", "btn-wed"] },
                        { "id": "txt-wed", "component": "Text", "text": "Wed · Miso salmon bowls — twenty minutes", "weight": 1 },
                        { "id": "btn-wed", "component": "Button", "child": "btl-wed", "variant": "secondary", "action": { "event": { "name": "tlon.sendMessage", "context": { "text": "Replace Wednesday's dinner" } } } },
                        { "id": "btl-wed", "component": "Text", "text": "Replace", "variant": "caption" },
                        { "id": "row-thu", "component": "Row", "justify": "spaceBetween", "align": "center", "children": ["txt-thu", "btn-thu"] },
                        { "id": "txt-thu", "component": "Text", "text": "Thu · Kale caesar with crispy chickpeas — good cold", "weight": 1 },
                        { "id": "btn-thu", "component": "Button", "child": "btl-thu", "variant": "secondary", "action": { "event": { "name": "tlon.sendMessage", "context": { "text": "Replace Thursday's dinner" } } } },
                        { "id": "btl-thu", "component": "Text", "text": "Replace", "variant": "caption" },
                        { "id": "row-fri", "component": "Row", "justify": "spaceBetween", "align": "center", "children": ["txt-fri", "btn-fri"] },
                        { "id": "txt-fri", "component": "Text", "text": "Fri · Sheet-pan sausage and peppers — hands-off", "weight": 1 },
                        { "id": "btn-fri", "component": "Button", "child": "btl-fri", "variant": "secondary", "action": { "event": { "name": "tlon.sendMessage", "context": { "text": "Replace Friday's dinner" } } } },
                        { "id": "btl-fri", "component": "Text", "text": "Replace", "variant": "caption" },
                        { "id": "row-sat", "component": "Row", "justify": "spaceBetween", "align": "center", "children": ["txt-sat", "btn-sat"] },
                        { "id": "txt-sat", "component": "Text", "text": "Sat · Fish tacos with cabbage slaw — weekend effort", "weight": 1 },
                        { "id": "btn-sat", "component": "Button", "child": "btl-sat", "variant": "secondary", "action": { "event": { "name": "tlon.sendMessage", "context": { "text": "Replace Saturday's dinner" } } } },
                        { "id": "btl-sat", "component": "Text", "text": "Replace", "variant": "caption" },
                        { "id": "row-sun", "component": "Row", "justify": "spaceBetween", "align": "center", "children": ["txt-sun", "btn-sun"] },
                        { "id": "txt-sun", "component": "Text", "text": "Sun · Ginger-sesame noodle bowls — uses the cabbage", "weight": 1 },
                        { "id": "btn-sun", "component": "Button", "child": "btl-sun", "variant": "secondary", "action": { "event": { "name": "tlon.sendMessage", "context": { "text": "Replace Sunday's dinner" } } } },
                        { "id": "btl-sun", "component": "Text", "text": "Replace", "variant": "caption" },
                        { "id": "div", "component": "Divider" },
                        { "id": "footer", "component": "Row", "justify": "spaceBetween", "align": "center", "children": ["btn-plans", "btn-good"] },
                        { "id": "btn-plans", "component": "Button", "child": "btl-plans", "variant": "borderless", "action": { "event": { "name": "tlon.navigate", "context": { "target": { "type": "channel", "channelId": "notes/~host/plans-example", "groupId": "~host/example" } } } } },
                        { "id": "btl-plans", "component": "Text", "text": "Open Meal Plans", "variant": "caption" },
                        { "id": "btn-good", "component": "Button", "child": "btl-good", "variant": "primary", "action": { "event": { "name": "tlon.sendMessage", "context": { "text": "The plan looks good" } } } },
                        { "id": "btl-good", "component": "Text", "text": "Looks good", "variant": "caption" }
                    ]
                }
            }
        ]
    },
    {
        "type": "interactive-surface",
        "version": 1,
        "surfaceId": "weekly-plan-2026-08-24-k3x9",
        "revision": 0,
        "state": {
            "week": "2026-08-24",
            "meals": [
                { "day": "Mon", "name": "Tacos al pastor", "reason": "25 minutes" },
                { "day": "Tue", "name": "Coconut chickpea curry", "reason": "uses the spinach" },
                { "day": "Wed", "name": "Miso salmon bowls", "reason": "twenty minutes" },
                { "day": "Thu", "name": "Kale caesar with crispy chickpeas", "reason": "good cold" },
                { "day": "Fri", "name": "Sheet-pan sausage and peppers", "reason": "hands-off" },
                { "day": "Sat", "name": "Fish tacos with cabbage slaw", "reason": "weekend effort" },
                { "day": "Sun", "name": "Ginger-sesame noodle bowls", "reason": "uses the cabbage" }
            ]
        },
        "processedActionIds": []
    }
]
```

## Creating the card

Write the JSON to a file first — never inline it in the command:

```bash
cat > /tmp/weekly-card.json << 'CARD'
[ ...the two entries... ]
CARD
tlon posts send <kitchen-nest> "<your one-line note>" --blob "$(cat /tmp/weekly-card.json)" --bot
```

Then find the post's id — the host assigns it, so read it back:

```bash
tlon messages channel <kitchen-nest> --limit 5
```

Your card is your newest post there (it shows a `blob`). Write `Meal Plan/Card.md` — create the file if it does not exist yet, which on a fresh install it will not — with the post id, the surfaceId, the current revision, and the week's meals. That file is how you find the card again next turn.

## Updating the card

When someone taps a control, their tap arrives as an ordinary message from them in the Kitchen ("Replace Wednesday's dinner", "The plan looks good"). Handle it in one turn:

1. Decide the change (a replacement meal, an acknowledgment, a preference noted).
2. Rebuild the **entire** blob array from `Meal Plan/Card.md` — both entries, every component. An edit stores the blob wholesale; anything you leave out is erased, and leaving out the a2ui entry deletes the card for everyone.
3. Bump `revision` by exactly 1 in the `interactive-surface` entry. On the changed day's row, replace the meal text and mention it changed (e.g. "Wed · Sheet-pan gnocchi — replaced"). Update `meta` if assumptions moved.
4. Edit the same post:

```bash
tlon posts edit <kitchen-nest> <post-id> --blob "$(cat /tmp/weekly-card.json)" --expected-revision <old-revision>
```

5. In the same turn, amend the week's note in Meal Plans (the grocery list must follow the change) and update `Meal Plan/Card.md` with the new revision and meals. Reply in the Kitchen only if there is something to say beyond what the card now shows — one short line at most.

"The plan looks good" deserves acknowledgment, not machinery: thank them in one line. If the schedule question has not come up yet, this is the moment to ask whether a fresh plan should arrive every week.
