# The primitive kit

Everything an app is allowed to draw. Read the entries for the components
you use; do not invent components or props — the shell exposes exactly what
is listed here, and anything else is a runtime `undefined`.

## The `surface` global

```js
const { html, h, primitives, register, invoke, canInvoke } = surface;
```

| member                 | what it is                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `html`                 | htm bound to Preact — tagged templates, no build step                                                     |
| `h`                    | Preact's `h`, if you prefer calls to templates                                                            |
| `primitives`           | the kit below                                                                                             |
| `register({ render })` | called once, at the end of your script                                                                    |
| `invoke(actionId)`     | fires a declared action as the viewer; returns `false` if the viewer can't write or the id isn't declared |
| `canInvoke()`          | whether the viewer may write                                                                              |
| `Chart`                | the raw Chart.js constructor. **Do not use it** — see `Chart` below                                       |

Nothing else exists: no hooks, no `render` from Preact, no DOM helpers, no
`document` work of your own.

## Writing markup with `html`

```js
html`
  <${Card} title=${state.question}>
    ${options.map((option) => html`<${ListRow}>${option.label}<//>`)}
  <//>
`;
```

- Components interpolate as tags: `<${Card} …>` … `<//>` closes any tag.
- Plain elements are fine for grouping: `<div>`, `<span>`, `<ul>`, `<li>`.
- Props interpolate as `prop=${value}`; children can be arrays.
- `data-testid=${'thing-' + id}` is allowed and useful — preview and e2e
  read it.

**There is no app CSS.** Only the shell's stylesheet reaches the page, so a
class name of your own has no styles behind it. Structure comes from the
primitives; keep any inline style to the gate's whitelisted layout subset
with token values (`var(--space-m)`), and never set `font-family` or a
literal color — the gate rejects both. If a layout needs more than that, it
needs a different composition of primitives.

---

## Card

A titled surface. The outermost thing in most apps; use one per logical
section rather than nesting them.

```js
const { Card } = primitives;

html`<${Card} title="Lunch poll">${rows}<//>`;
```

| prop     | type      | notes                      |
| -------- | --------- | -------------------------- |
| `title`  | `string?` | omitted renders no heading |
| children | nodes     | the body                   |

---

## ListRow

One row of a list: optional leading and trailing slots around a content
column. This is the workhorse — a member with a control, an option with a
count, an item with a badge.

```js
const { ListRow, Avatar, Button } = primitives;

html`
  <${ListRow}
    left=${html`<${Avatar} ship=${ship} />`}
    right=${html`<${Button} onPress=${() => invoke("vote-pizza")}>Vote<//>`}
  >
    ${label}
  <//>
`;
```

| prop     | type   | notes                                          |
| -------- | ------ | ---------------------------------------------- |
| `left`   | nodes? | leading slot — avatar, index, icon-sized thing |
| `right`  | nodes? | trailing slot — control, badge, value          |
| children | nodes  | the content column                             |

---

## Button

The only control. Every button either invokes a declared action or does
nothing — there are no other effects available.

```js
const { Button } = primitives;

html`
  <${Button}
    tone="positive"
    disabled=${!canInvoke()}
    onPress=${() => invoke("squat-ok")}
  >
    All reps
  <//>
`;
```

| prop       | type                                    | notes                                                    |
| ---------- | --------------------------------------- | -------------------------------------------------------- |
| `onPress`  | handler?                                | not `onClick`                                            |
| `disabled` | `boolean?`                              | when true the handler is not attached at all             |
| `tone`     | `'neutral' \| 'positive' \| 'negative'` | defaults to neutral; anything else is treated as neutral |
| children   | nodes                                   | the label                                                |

Disable on `!canInvoke()` rather than hiding: read-only viewers should see
the same screen.

---

## Stat

A single number with its label, for the top-of-card summary.

```js
const { Stat } = primitives;

html`<${Stat}
  value=${String(total)}
  label="votes cast"
  hint="one per person"
/>`;
```

| prop    | type      | notes                                                                          |
| ------- | --------- | ------------------------------------------------------------------------------ |
| `value` | `string`  | **strings only** — `String(n)`, and format integers to their display unit here |
| `label` | `string`  | what the number is                                                             |
| `hint`  | `string?` | small secondary line                                                           |

---

## Badge

A short inline tag against a row or title: a count, a status, a state word.

```js
const { Badge } = primitives;

html`<${Badge} tone="negative">Missed<//>`;
```

| prop     | type                                    | notes                         |
| -------- | --------------------------------------- | ----------------------------- |
| `tone`   | `'neutral' \| 'positive' \| 'negative'` | defaults to neutral           |
| children | nodes                                   | keep it to a word or a number |

---

## Avatar

Draws a real sigil from a ship name, colored from the theme tokens. Apps
never render sigils themselves and never choose a size.

```js
const { Avatar } = primitives;

html`<${Avatar} ship=${ship} />`;
```

| prop       | type      | notes                                                                                                        |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| `ship`     | `string?` | a point name — `~zod`, `~sampel-palnet`. State keys written by `$actor` are exactly this form                |
| `initials` | `string?` | fallback text, first two characters used                                                                     |
| `color`    | `string?` | tints the frame _behind_ the sigil; must be a token reference (`var(--color-bg-secondary)`), never a literal |

A name the library cannot draw (a moon, a comet, a malformed string) falls
back to initials instead of throwing — `ship` comes from app state, so a bad
one is ordinary input. With no `initials`, the fallback is the first two
characters of the name.

---

## Progress

A proportion bar. Accessible by default when you pass a label.

```js
const { Progress } = primitives;

html`<${Progress}
  value=${total === 0 ? 0 : count / total}
  label=${option.label}
/>`;
```

| prop    | type      | notes                                                               |
| ------- | --------- | ------------------------------------------------------------------- |
| `value` | `number`  | a **fraction 0–1**, not a percentage. Clamped; non-finite becomes 0 |
| `label` | `string?` | accessible name                                                     |

---

## EmptyState

The screen before anything has happened — which is the screen the user sees
first, so write it as carefully as the populated one. Say what will appear
here, in the domain's words, never in the app's mechanics.

```js
const { EmptyState } = primitives;

html`<${EmptyState}
  title="Nobody has signed up yet"
  description="Tap a slot to put your name down."
/>`;
```

| prop          | type      | notes        |
| ------------- | --------- | ------------ |
| `title`       | `string`  | required     |
| `description` | `string?` | one sentence |

---

## SectionHeader

A heading inside a card, above a group of rows.

```js
const { SectionHeader } = primitives;

html`<${SectionHeader}>Turnout<//>`;
```

| prop     | type  | notes       |
| -------- | ----- | ----------- |
| children | nodes | short label |

---

## Chart

The only chart path. Pass data and options; the primitive owns the
container, the canvas, and the Chart.js instance across re-renders.

```js
const { Chart } = primitives;

html`
  <${Chart}
    type="line"
    size="compact"
    label="Squat weight over time"
    data=${{
      labels: dates,
      datasets: [{ label: "Squat", data: weights }],
    }}
    options=${{ scales: { y: { beginAtZero: false } } }}
  />
`;
```

| prop      | type                               | notes                                                                                                                                              |
| --------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`    | `string`                           | the shell registers all standard Chart.js controllers: `'bar'`, `'line'`, `'doughnut'`, `'pie'`, `'radar'`, `'polarArea'`, `'bubble'`, `'scatter'` |
| `data`    | `object`                           | Chart.js data. **Omit dataset colors** — datasets with neither `borderColor` nor `backgroundColor` are colored from the theme tokens               |
| `options` | `object?`                          | Chart.js options **minus sizing**. `responsive` and `maintainAspectRatio` are applied after yours and cannot be overridden                         |
| `size`    | `'compact' \| 'default' \| 'tall'` | named aspect-ratio shapes, not pixels                                                                                                              |
| `label`   | `string?`                          | accessible name for the canvas                                                                                                                     |

Rules:

- **Never set `width`, `height`, `responsive`, or `maintainAspectRatio`, and
  never create a `<canvas>` yourself.** Two early bundles hardcoded a pixel
  canvas and overflowed every phone. The gate checks this behaviorally after
  rendering your bundle: no `<canvas>` may carry `width`/`height`
  attributes, and every live chart must report `responsive: true`.
- **Do not use `surface.Chart` (the raw constructor).** Chart.js degrades
  cleanly on _construction_ only: `chart.update()` with no 2D context
  **throws**, and a throw inside render replaces your whole app with the
  error box. The primitive guards it with a destroy-and-rebuild fallback;
  your own code will not.
- Animation is off by default (stable screenshots); you can re-enable it
  through `options`, and generally shouldn't.
- A shell built without the charting library renders a labeled empty state
  instead of throwing, so a chart is always safe to include.

---

## Not in the kit

`BrokenState` is the harness's own error view. It is not part of
`primitives` and apps never render it — a throw in `render` produces it
automatically.
