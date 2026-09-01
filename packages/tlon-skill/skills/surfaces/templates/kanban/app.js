// Kanban board — the shared-board template.
//
// Poll and workout-tracker both hold PER-MEMBER state: a vote at
// /votes/$actor, an outcome at /today/$actor/<lift>. A board is the other
// shape. Which column a card is in is one value the whole group shares, so
// a move writes a FIXED path — /tasks/<card>/status — and the last member
// to press wins. That is what a board is for, and the move is still
// idempotent: pressing "Done" twice writes the same word to the same place.
//
// The per-member half is the marker. Every move also writes /claims/$actor
// with the card's id, so the board can show where each person is standing.
// One key per member means a marker sits on exactly one card and a second
// press never adds a second marker.
//
// What to preserve when you copy this: A COLUMN KEY AND AN ACTION ID ARE
// PERMANENT ONCE THE BOARD IS RUNNING. The column key is written into every
// card's status; the action id is written into every press members have
// already made. Renaming either strands what is already there — NOTES.md
// has the rule, what it breaks, and how to add a column without disturbing
// anything.
(function () {
  const { html, primitives, invoke, canInvoke } = surface;
  const {
    Card,
    ListRow,
    Button,
    Badge,
    Avatar,
    Stat,
    Progress,
    SectionHeader,
    EmptyState,
  } = primitives;

  // THE COLUMNS LIVE HERE, NOT IN STATE. A column is only real if something
  // can move a card into it, and the things that move cards are declared in
  // spec.json — so the column list belongs next to the handler table, where
  // the two can only be edited together. Keep it in state instead and a
  // host event can add a column no button reaches.
  //
  // Order is left to right down the board. Inserting one in the middle is
  // safe. Renaming a `key` is not.
  const COLUMNS = [
    { key: 'todo', label: 'To do' },
    { key: 'doing', label: 'Doing' },
    { key: 'blocked', label: 'Blocked' },
    { key: 'done', label: 'Done' },
  ];

  // ONE ENTRY PER ACTION DECLARED IN spec.json, keyed by card id and then
  // by the column it moves that card into. Every argument is a literal on
  // purpose: the publish gate cross-references literals against the spec,
  // so a typo here fails the gate instead of shipping a button that
  // silently does nothing. Writing `invoke(id + '-' + key)` is shorter and
  // turns that check off for the whole app — which on a board this size
  // means turning it off for 24 buttons at once.
  //
  // Adding a card is three edits the gate keeps consistent: the card in
  // `initialState.tasks` and `taskOrder`, its four actions in spec.json,
  // and its entry here. A card with no entry renders dead buttons —
  // visibly inert rather than quietly doing nothing.
  const MOVE = {
    theme: {
      todo: function () {
        return invoke('theme-todo');
      },
      doing: function () {
        return invoke('theme-doing');
      },
      blocked: function () {
        return invoke('theme-blocked');
      },
      done: function () {
        return invoke('theme-done');
      },
    },
    pitches: {
      todo: function () {
        return invoke('pitches-todo');
      },
      doing: function () {
        return invoke('pitches-doing');
      },
      blocked: function () {
        return invoke('pitches-blocked');
      },
      done: function () {
        return invoke('pitches-done');
      },
    },
    interviews: {
      todo: function () {
        return invoke('interviews-todo');
      },
      doing: function () {
        return invoke('interviews-doing');
      },
      blocked: function () {
        return invoke('interviews-blocked');
      },
      done: function () {
        return invoke('interviews-done');
      },
    },
    layout: {
      todo: function () {
        return invoke('layout-todo');
      },
      doing: function () {
        return invoke('layout-doing');
      },
      blocked: function () {
        return invoke('layout-blocked');
      },
      done: function () {
        return invoke('layout-done');
      },
    },
    proof: {
      todo: function () {
        return invoke('proof-todo');
      },
      doing: function () {
        return invoke('proof-doing');
      },
      blocked: function () {
        return invoke('proof-blocked');
      },
      done: function () {
        return invoke('proof-done');
      },
    },
    print: {
      todo: function () {
        return invoke('print-todo');
      },
      doing: function () {
        return invoke('print-doing');
      },
      blocked: function () {
        return invoke('print-blocked');
      },
      done: function () {
        return invoke('print-done');
      },
    },
  };

  const has = function (object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  };

  const LABELS = {};
  for (const column of COLUMNS) {
    LABELS[column.key] = column.label;
  }

  const FIRST = COLUMNS[0];
  const LAST = COLUMNS[COLUMNS.length - 1];

  /**
   * The column a card is in. A card whose stored column is not one of
   * COLUMNS lands in the first column rather than falling off the board —
   * which is exactly what a renamed column key does to every card already
   * holding the old one.
   */
  const columnOf = function (task) {
    const key = task && task.status;
    return has(LABELS, key) ? key : FIRST.key;
  };

  /** ship -> card id, inverted to card id -> the ships standing on it. */
  const markersByCard = function (claims) {
    const markers = {};
    for (const ship of Object.keys(claims).sort()) {
      const id = claims[ship];
      if (typeof id !== 'string') {
        continue;
      }
      if (!has(markers, id)) {
        markers[id] = [];
      }
      markers[id].push(ship);
    }
    return markers;
  };

  /**
   * One card. The three columns it is not in become the three buttons that
   * move it there, so the control reads as the place it sends the card.
   */
  const cardRow = function (id, task, here, onIt) {
    const moves = has(MOVE, id) ? MOVE[id] : {};
    return html`
      <${ListRow}>
        <div data-testid=${'kanban-card-' + id}>
          <div>${task.label || id}</div>
          <div>${task.note || ''}</div>
          ${onIt.length === 0
            ? null
            : html`
                <div
                  style=${{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 'var(--space-m)',
                  }}
                >
                  ${onIt.map(function (ship) {
                    return html`
                      <span
                        style=${{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 'var(--space-xs)',
                        }}
                      >
                        <${Avatar} ship=${ship} />${ship}
                      </span>
                    `;
                  })}
                </div>
              `}
          <div
            style=${{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 'var(--space-m)',
            }}
          >
            ${COLUMNS.map(function (destination) {
              if (destination.key === here) {
                return null;
              }
              return html`
                <${Button}
                  disabled=${!canInvoke() || !has(moves, destination.key)}
                  onPress=${moves[destination.key]}
                >
                  ${destination.label}
                <//>
              `;
            })}
          </div>
        </div>
      <//>
    `;
  };

  surface.register({
    render(state) {
      // State is shared, so every read defaults: one member's odd entry
      // must not break the board for the whole group.
      const tasks =
        state.tasks && typeof state.tasks === 'object' ? state.tasks : {};
      const order = Array.isArray(state.taskOrder)
        ? state.taskOrder
        : Object.keys(tasks).sort();
      const claims =
        state.claims && typeof state.claims === 'object' ? state.claims : {};
      const title = state.board || 'Board';

      if (order.length === 0) {
        return html`
          <${Card} title=${title}>
            <${EmptyState}
              title="No cards yet"
              description="This board has nothing on it to move."
            />
          <//>
        `;
      }

      const markers = markersByCard(claims);
      const byColumn = {};
      for (const column of COLUMNS) {
        byColumn[column.key] = [];
      }
      for (const id of order) {
        byColumn[columnOf(tasks[id])].push(id);
      }

      const finished = byColumn[LAST.key].length;
      const crew = Object.keys(claims).sort();

      // The instruction below is a plain line and not the `Stat`'s hint:
      // hints render tertiary, and tertiary text is the first thing to go
      // unreadable in dark — which is no place for the one sentence telling
      // a first-time member what to do.
      return html`
        <${Card} title=${title}>
          <${Stat}
            value=${String(finished) + ' of ' + String(order.length)}
            label=${'cards in ' + LAST.label}
          />
          <${Progress}
            value=${order.length === 0 ? 0 : finished / order.length}
            label=${'cards in ' + LAST.label}
          />
          <div>${'Tap a column on a card to move it there.'}</div>
          ${COLUMNS.map(function (column) {
            const ids = byColumn[column.key];
            return html`
              <div data-testid=${'kanban-column-' + column.key}>
                <${SectionHeader}>
                  ${column.label + ' '}<${Badge}>${String(ids.length)}<//>
                <//>
                ${ids.length === 0
                  ? html`<${ListRow}>${'Nothing here yet.'}<//>`
                  : ids.map(function (id) {
                      return cardRow(
                        id,
                        tasks[id] || {},
                        column.key,
                        has(markers, id) ? markers[id] : []
                      );
                    })}
              </div>
            `;
          })}
        <//>

        <${Card} title="Who's on what">
          ${crew.length === 0
            ? html`
                <${EmptyState}
                  title="Nobody has picked up a card yet"
                  description="Moving a card puts your name on it."
                />
              `
            : crew.map(function (ship) {
                const id = claims[ship];
                const task = has(tasks, id) ? tasks[id] : {};
                return html`
                  <${ListRow}
                    left=${html`<${Avatar} ship=${ship} />`}
                    right=${html`<${Badge}>${LABELS[columnOf(task)]}<//>`}
                  >
                    <div data-testid=${'kanban-crew-' + ship}>
                      <div>${ship}</div>
                      <div>${task.label || String(id)}</div>
                    </div>
                  <//>
                `;
              })}
        <//>
      `;
    },
  });
})();
