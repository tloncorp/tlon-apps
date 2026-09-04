// Habit tracker — the LAZY host-is-the-clock template.
//
// Members mark a habit done for the day; the board shows the day in
// progress and the days already on it. Every number here — how many marks
// are in, each member's current run, the strip of past days — is derived in
// `render` from `/today` + `/history`. State holds the log and nothing else.
//
// The log uses host-is-the-clock (PARADIGM.md §2), never `append`: a mark
// is an idempotent `set /today/$actor/<habit>` with a literal, so a
// double-tap, a transport retry and the same member on two devices all
// write the same value to the same key and change nothing.
//
// WHAT MAKES THIS TEMPLATE DIFFERENT FROM workout-tracker: the rollover is
// LAZY. No timer, no cron, no schedule. The channel host archives the day
// and clears it the next time it has business with this channel anyway, and
// a day that closes at nine in the morning instead of at midnight is a day
// this board can carry. NOTES.md has the two reasons and the exact ops.
//
// Two things this app deliberately does not do:
//   - it never reads a clock, and it never asks the host for one. There is
//     no `timeDisplay` in the spec and no `context` argument here, because
//     nothing on this screen depends on what time it is: the day in
//     progress is "today" until the host closes it, and the dates on the
//     past-days list are dates the host wrote down. A board that read the
//     viewer's clock would draw the day boundary in a different place for a
//     member in Lisbon than for one in Los Angeles, and tell neither.
//   - it cannot say which member is looking at it. So the controls are
//     labelled "you", and the whole crew is rendered with each member's
//     sigil for the viewer to find themselves in.
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

  const has = function (object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  };

  // ONE ENTRY PER ACTION DECLARED IN spec.json, keyed by habit id. Every
  // argument is a literal on purpose: the publish gate cross-references
  // literals against the spec, so a typo here fails the gate instead of
  // shipping a button that silently does nothing. Writing
  // `invoke('did-' + id)` is shorter and turns that check off for the whole
  // app.
  //
  // Adding a habit is three edits the gate keeps consistent: the habit in
  // `initialState.habits` and `habitOrder`, its action in spec.json, and
  // its line here. A habit with no line renders a dead button — visibly
  // inert rather than quietly doing nothing.
  const MARK = {
    water: function () {
      return invoke('did-water');
    },
    move: function () {
      return invoke('did-move');
    },
    read: function () {
      return invoke('did-read');
    },
    lights: function () {
      return invoke('did-lights');
    },
  };

  const clearMine = function () {
    return invoke('clear-today');
  };

  /* ---------------------------------------------------------------- */
  /* derivation                                                        */
  /*                                                                   */
  /* State is shared, so every read defaults and every shape is        */
  /* checked: one member's odd entry must not throw the board for the  */
  /* whole group.                                                      */
  /* ---------------------------------------------------------------- */

  const objectAt = function (value) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  };

  /** The days on the board, oldest first. ISO dates sort lexicographically. */
  const datesOf = function (history) {
    return Object.keys(history).sort();
  };

  /** Everybody who has ever marked anything, today or on a past day. */
  const crewOf = function (history, today) {
    const seen = {};
    for (const date of Object.keys(history)) {
      for (const ship of Object.keys(objectAt(history[date]))) {
        seen[ship] = true;
      }
    }
    for (const ship of Object.keys(today)) {
      seen[ship] = true;
    }
    return Object.keys(seen).sort();
  };

  /** How many of the board's habits one member marked in one day. */
  const marksIn = function (day, order) {
    const marks = objectAt(day);
    let count = 0;
    for (const id of order) {
      if (marks[id]) {
        count += 1;
      }
    }
    return count;
  };

  /**
   * The member's current run: days from the newest end of the board
   * backwards, counting while they marked every habit, stopping at the
   * first day they did not.
   *
   * A run counts DAYS ON THE BOARD, not calendar days — the host decides
   * where one day ends, and a day it closed late covers everything since
   * the last one. NOTES.md has what that costs and why it is affordable.
   */
  const runFor = function (history, dates, ship, order) {
    let run = 0;
    for (let index = dates.length - 1; index >= 0; index--) {
      const day = objectAt(history[dates[index]])[ship];
      if (marksIn(day, order) < order.length) {
        break;
      }
      run += 1;
    }
    return run;
  };

  /** "✓ ✓ · ✓" — one glyph per day shown, oldest first. */
  const stripFor = function (history, dates, ship, order) {
    return dates
      .map(function (date) {
        const day = objectAt(history[date])[ship];
        return marksIn(day, order) === order.length ? '✓' : '·';
      })
      .join(' ');
  };

  /** "1 day running" / "4 days running" — never "1 days". */
  const runLabel = function (run) {
    return String(run) + (run === 1 ? ' day running' : ' days running');
  };

  const AVATAR_ROW = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 'var(--space-m)',
  };

  const AVATAR_NAME = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-xs)',
  };

  /* ---------------------------------------------------------------- */
  /* render                                                            */
  /* ---------------------------------------------------------------- */

  surface.register({
    render(state) {
      const habits = objectAt(state.habits);
      const order = Array.isArray(state.habitOrder)
        ? state.habitOrder
        : Object.keys(habits).sort();
      const history = objectAt(state.history);
      const today = objectAt(state.today);
      const board = typeof state.board === 'string' ? state.board : 'Habits';
      const daysShown =
        typeof state.daysShown === 'number' && state.daysShown > 0
          ? state.daysShown
          : 7;

      if (order.length === 0) {
        return html`
          <${Card} title=${board}>
            <${EmptyState}
              title="No habits yet"
              description="This board has nothing on it to mark."
            />
          <//>
        `;
      }

      const dates = datesOf(history);
      const shown = dates.slice(Math.max(0, dates.length - daysShown));
      const crew = crewOf(history, today);

      let marks = 0;
      for (const ship of crew) {
        marks += marksIn(today[ship], order);
      }
      const possible = crew.length * order.length;

      // The instruction below is a plain line rather than the `Stat`'s
      // hint: hints render tertiary, and tertiary is the first text to go
      // unreadable in dark — no place for the one sentence telling a
      // first-time member what to do.
      return html`
        <${Card} title=${board}>
          <${Stat}
            value=${possible === 0
              ? '0'
              : String(marks) + ' of ' + String(possible)}
            label="marks in today"
          />
          <${Progress}
            value=${possible === 0 ? 0 : marks / possible}
            label="marks in today"
          />
          <div>${'Tap Done on each habit as you get to it.'}</div>

          <${SectionHeader}>Today<//>
          ${order.map(function (id) {
            const habit = objectAt(habits[id]);
            const doers = crew.filter(function (ship) {
              return objectAt(today[ship])[id];
            });
            return html`
              <${ListRow}
                right=${html`
                  <${Button}
                    tone="positive"
                    disabled=${!canInvoke() || !has(MARK, id)}
                    onPress=${MARK[id]}
                  >
                    ${'Done'}
                  <//>
                `}
                secondary=${html`
                  <div>${habit.detail || ''}</div>
                  <div style=${AVATAR_ROW}>
                    ${doers.length === 0
                      ? html`<span>${'Nobody yet today'}</span>`
                      : doers.map(function (ship) {
                          return html`<${Avatar} ship=${ship} />`;
                        })}
                  </div>
                `}
              >
                <div>${habit.label || id}</div>
              <//>
            `;
          })}

          <${ListRow}
            right=${html`
              <${Button} disabled=${!canInvoke()} onPress=${clearMine}>
                ${'Clear'}
              <//>
            `}
          >
            <div>
              ${'Mis-tapped? This clears only your own marks for today.'}
            </div>
          <//>
        <//>

        <${Card} title="The crew">
          ${shown.length === 0
            ? null
            : html`<div>
                ${'Recent days run oldest to newest — a ✓ is a day with everything marked.'}
              </div>`}
          ${crew.length === 0
            ? html`
                <${EmptyState}
                  title="Nobody has marked anything yet"
                  description="Tap Done on a habit and your name shows up here."
                />
              `
            : crew.map(function (ship) {
                const run = runFor(history, dates, ship, order);
                return html`
                  <${ListRow}
                    left=${html`<${Avatar} ship=${ship} />`}
                    right=${run === 0
                      ? null
                      : html`<${Badge} tone="positive">${runLabel(run)}<//>`}
                    secondary=${html`
                      <div>
                        ${String(marksIn(today[ship], order)) +
                        ' of ' +
                        String(order.length) +
                        ' today'}
                      </div>
                      <div>${stripFor(history, shown, ship, order)}</div>
                    `}
                  >
                    <div>${ship}</div>
                  <//>
                `;
              })}
        <//>

        <${Card} title="Past days">
          ${shown.length === 0
            ? html`
                <${EmptyState}
                  title="No days saved yet"
                  description="Finished days will be listed here, newest first."
                />
              `
            : shown
                .slice()
                .reverse()
                .map(function (date) {
                  const day = objectAt(history[date]);
                  const ships = Object.keys(day).sort();
                  return html`
                    <${ListRow}>
                      <div>
                        <div>${date}</div>
                        ${ships.length === 0
                          ? html`<div>${'Nobody marked anything.'}</div>`
                          : ships.map(function (ship) {
                              const count = marksIn(day[ship], order);
                              return html`
                                <div style=${AVATAR_ROW}>
                                  <span style=${AVATAR_NAME}>
                                    <${Avatar} ship=${ship} />${ship}
                                  </span>
                                  <${Badge}
                                    tone=${count === order.length
                                      ? 'positive'
                                      : 'neutral'}
                                  >
                                    ${String(count) +
                                    ' of ' +
                                    String(order.length)}
                                  <//>
                                </div>
                              `;
                            })}
                      </div>
                    <//>
                  `;
                })}
        <//>
      `;
    },
  });
})();
