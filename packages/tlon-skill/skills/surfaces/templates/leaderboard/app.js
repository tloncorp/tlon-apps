// Leaderboard — the template where nothing is a running total.
//
// A standings table is the most tempting place to store a number: wins,
// losses, points, a streak. Do not. State here holds ONE fact per member per
// round — "I won", "I lost" — and every number on screen is counted out of
// that log at render time: played, won, lost, the run somebody is on, their
// position and their win rate.
//
// The reason is not tidiness, it is that a stored total cannot be corrected.
// The op language has no arithmetic, so an action can only write a literal;
// "wins = wins + 1" is not expressible, and the shapes that fake it — an
// `append` per win, a counter written by the app — all break the moment an
// entry arrives twice (PARADIGM.md §2). A result written at
// `/results/<round>/$actor` is idempotent: pressing twice writes the same
// word to the same place, pressing the other button corrects it, and the
// table is recounted from scratch either way.
//
// Rates are integers too. `won / played` is 0.7777777777777778, and a table
// that prints it — or rounds it late — is the same class of defect as a
// bill-splitter that loses a cent. Multiply first, round once, carry basis
// points, divide only in the formatter (PARADIGM.md §5).
//
// This app never calls `Date`: rounds are the ones the board lists, and
// which one is "this week" is not something the viewer's clock is allowed
// to decide. And it cannot know who is looking at it, so the controls say
// "I won" / "I lost" and the whole table is shown, every row led by that
// member's sigil.
(function () {
  const { html, primitives, invoke, canInvoke } = surface;
  const {
    Card,
    ListRow,
    Button,
    Stat,
    Badge,
    Avatar,
    EmptyState,
    Progress,
    Chart,
  } = primitives;

  // ONE ENTRY PER ROUND DECLARED IN spec.json, keyed by round id. Each
  // invoke() argument is a literal on purpose: the publish gate
  // cross-references literals against the spec, so a typo here fails the
  // gate instead of shipping a button that silently does nothing. Writing
  // `invoke(round.id + '-won')` reads better and turns that check off for
  // the whole app.
  //
  // Adding a round is three edits the gate keeps consistent: the round in
  // `initialState.rounds` (plus `roundOrder`), its two actions in
  // spec.json, and its line here. A round with no line renders disabled
  // buttons — visibly inert rather than quietly dead.
  const LOG = {
    r1: {
      won: function () {
        return invoke('won-r1');
      },
      lost: function () {
        return invoke('lost-r1');
      },
    },
    r2: {
      won: function () {
        return invoke('won-r2');
      },
      lost: function () {
        return invoke('lost-r2');
      },
    },
    r3: {
      won: function () {
        return invoke('won-r3');
      },
      lost: function () {
        return invoke('lost-r3');
      },
    },
    r4: {
      won: function () {
        return invoke('won-r4');
      },
      lost: function () {
        return invoke('lost-r4');
      },
    },
    r5: {
      won: function () {
        return invoke('won-r5');
      },
      lost: function () {
        return invoke('lost-r5');
      },
    },
  };

  const has = function (object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  };

  /* ---------------------------------------------------------------- */
  /* reading the log                                                   */
  /* ---------------------------------------------------------------- */

  const resultsOf = function (state) {
    return state.results && typeof state.results === 'object'
      ? state.results
      : {};
  };

  /** The rounds this board runs, in the order it lists them. */
  const roundsOf = function (state) {
    const rounds =
      state.rounds && typeof state.rounds === 'object' ? state.rounds : {};
    const order = Array.isArray(state.roundOrder)
      ? state.roundOrder
      : Object.keys(rounds).sort();
    const listed = [];
    for (const id of order) {
      if (typeof id !== 'string' || !has(rounds, id)) {
        continue;
      }
      listed.push({ id: id, label: (rounds[id] || {}).label || id });
    }
    return listed;
  };

  /** Everyone who has a result anywhere in the log. */
  const playersOf = function (state, rounds) {
    const results = resultsOf(state);
    const seen = {};
    for (const round of rounds) {
      for (const ship of Object.keys(results[round.id] || {})) {
        seen[ship] = true;
      }
    }
    return Object.keys(seen).sort();
  };

  const outcomeOf = function (results, roundId, ship) {
    const round = results[roundId];
    if (!round || typeof round !== 'object') {
      return null;
    }
    const outcome = round[ship];
    return outcome === 'won' || outcome === 'lost' ? outcome : null;
  };

  /* ---------------------------------------------------------------- */
  /* counting — every number below is counted here, never stored       */
  /* ---------------------------------------------------------------- */

  /**
   * One player's record, read straight off the log in round order.
   *
   * A round somebody sat out neither counts nor breaks a run: it is not a
   * loss, and a board that treated it as one would quietly punish anybody
   * who missed a week.
   */
  const recordFor = function (state, rounds, ship) {
    const results = resultsOf(state);
    const form = [];
    let won = 0;
    let lost = 0;
    let run = 0;
    let runKind = null;
    for (const round of rounds) {
      const outcome = outcomeOf(results, round.id, ship);
      if (outcome === null) {
        form.push('–');
        continue;
      }
      if (outcome === 'won') {
        won += 1;
      } else {
        lost += 1;
      }
      if (runKind === outcome) {
        run += 1;
      } else {
        runKind = outcome;
        run = 1;
      }
      form.push(outcome === 'won' ? 'W' : 'L');
    }
    const played = won + lost;
    return {
      ship: ship,
      won: won,
      lost: lost,
      played: played,
      form: form,
      run: run,
      runKind: runKind,
      // Basis points: multiply BEFORE dividing and round once, so what the
      // table carries is a whole number. `won / played` kept as a fraction
      // and formatted later is how 0.7777777777777778 reaches a screen.
      rate: played === 0 ? 0 : Math.round((won * 10000) / played),
    };
  };

  /**
   * Most wins first, then fewest losses, then alphabetically so every
   * viewer sees the same order. Players level on both counts share a
   * position — two people on 2-2 are joint third, and printing 3 and 4
   * beside identical records reads as a bug.
   */
  const tableOf = function (state, rounds, players) {
    const table = players.map(function (ship) {
      return recordFor(state, rounds, ship);
    });
    table.sort(function (left, right) {
      return (
        right.won - left.won ||
        left.lost - right.lost ||
        (left.ship < right.ship ? -1 : left.ship > right.ship ? 1 : 0)
      );
    });
    let position = 0;
    table.forEach(function (entry, index) {
      const above = index === 0 ? null : table[index - 1];
      if (
        above === null ||
        above.won !== entry.won ||
        above.lost !== entry.lost
      ) {
        position = index + 1;
      }
      entry.position = position;
    });
    return table;
  };

  /** Basis points to one decimal place, by integer division only. */
  const percent = function (rate) {
    const tenths = Math.round(rate / 10);
    return String(Math.floor(tenths / 10)) + '.' + String(tenths % 10) + '%';
  };

  const runLine = function (entry) {
    if (entry.run < 2 || entry.runKind === null) {
      return null;
    }
    return entry.runKind === 'won'
      ? String(entry.run) + ' wins in a row'
      : String(entry.run) + ' losses in a row';
  };

  /* ---------------------------------------------------------------- */
  /* chart                                                             */
  /* ---------------------------------------------------------------- */

  // Wins carried forward round by round — the race, counted from the same
  // log the table is. The `Chart` primitive owns the container, the canvas
  // and the instance: this hands it a series and nothing else, no width, no
  // height, no colors.
  const raceData = function (state, rounds, table) {
    const results = resultsOf(state);
    return {
      labels: rounds.map(function (round) {
        return round.label;
      }),
      datasets: table.map(function (entry) {
        let running = 0;
        return {
          label: entry.ship,
          data: rounds.map(function (round) {
            if (outcomeOf(results, round.id, entry.ship) === 'won') {
              running += 1;
            }
            return running;
          }),
          borderWidth: 2,
          pointRadius: 3,
          tension: 0,
        };
      }),
    };
  };

  /* ---------------------------------------------------------------- */
  /* render                                                            */
  /* ---------------------------------------------------------------- */

  surface.register({
    render(state) {
      // State is shared, so every read defaults: one odd entry must not
      // throw the board for the whole group.
      const rounds = roundsOf(state);
      const results = resultsOf(state);
      const players = playersOf(state, rounds);
      const table = tableOf(state, rounds, players);

      let roundsPlayed = 0;
      for (const round of rounds) {
        if (Object.keys(results[round.id] || {}).length > 0) {
          roundsPlayed += 1;
        }
      }

      return html`
        <${Card} title=${state.ladder || 'Leaderboard'}>
          <${Stat}
            value=${String(roundsPlayed)}
            label="rounds played"
            hint="ranked by wins, then by fewest losses"
          />
          ${table.length === 0
            ? html`<${EmptyState}
                title="No results yet"
                description="Say how you got on below and the table fills in."
              />`
            : table.map(function (entry) {
                const run = runLine(entry);
                return html`
                  <${ListRow}
                    left=${html`<${Avatar} ship=${entry.ship} />`}
                    right=${html`<${Badge}>${percent(entry.rate)}<//>`}
                  >
                    <div data-testid=${'ladder-player-' + entry.ship}>
                      <div>${String(entry.position) + '. ' + entry.ship}</div>
                      <div>
                        ${'won ' +
                        String(entry.won) +
                        ' of ' +
                        String(entry.played) +
                        ' '}
                        ${run === null
                          ? null
                          : html`<${Badge}
                              tone=${entry.runKind === 'won'
                                ? 'positive'
                                : 'negative'}
                              >${run}<//
                            >`}
                      </div>
                      <div>${entry.form.join(' ')}</div>
                      <${Progress}
                        value=${entry.rate / 10000}
                        label=${entry.ship + ' wins'}
                      />
                    </div>
                  <//>
                `;
              })}
        <//>

        <${Card} title="How did you get on?">
          ${rounds.length === 0
            ? html`<${EmptyState}
                title="No rounds yet"
                description="This board has no rounds to play."
              />`
            : rounds.map(function (round) {
                const log = LOG[round.id] || {};
                const entries = Object.keys(results[round.id] || {}).length;
                return html`
                  <${ListRow}
                    right=${html`
                      <div style="display: flex; gap: var(--space-m)">
                        <${Button}
                          tone="positive"
                          disabled=${!canInvoke() || !log.won}
                          onPress=${log.won}
                        >
                          I won
                        <//>
                        <${Button}
                          tone="negative"
                          disabled=${!canInvoke() || !log.lost}
                          onPress=${log.lost}
                        >
                          I lost
                        <//>
                      </div>
                    `}
                  >
                    <div data-testid=${'ladder-round-' + round.id}>
                      <div>${round.label}</div>
                      <div>
                        ${entries === 0
                          ? 'nobody has said yet'
                          : String(entries) + ' played'}
                      </div>
                    </div>
                  <//>
                `;
              })}
        <//>

        <${Card} title="Wins as the season goes">
          ${table.length === 0
            ? html`<${EmptyState}
                title="Nothing to chart yet"
                description="The race appears here once people start winning."
              />`
            : html`<div data-testid="ladder-chart-host">
                <${Chart}
                  type="line"
                  label="Wins round by round"
                  data=${raceData(state, rounds, table)}
                  options=${{
                    scales: {
                      y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    },
                  }}
                />
              </div>`}
        <//>
      `;
    },
  });
})();
