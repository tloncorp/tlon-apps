// StrongLifts 5×5 tracker — the derived-state template.
//
// The op language has no arithmetic, so "add 2.5 kg" is not expressible as
// an op. The pattern this template exists to teach is that STATE HOLDS ONLY
// THE LOG and `render` derives everything else: working weight, the A/B
// alternation, consecutive-failure streaks, deload triggers and the
// weight-over-time chart are all computed here, in ordinary unrestricted
// JavaScript, from `history` + `today`.
//
// The log itself uses host-is-the-clock (PARADIGM.md §2) rather than
// `append`: a member's action is an idempotent `set /today/$actor/<lift>`
// with a literal outcome, and the channel host posts one host event that
// archives `/today` under a date it computes from its own fold and then
// deletes `/today`. A double-tap re-sets the same path to the same literal
// and changes nothing, so this template does not inherit `append`'s
// duplicate caveat. NOTES.md says what the host owes this app.
//
// Two things this app deliberately does not do, because v0 cannot:
//   - it never calls `Date`. The sandbox has a clock, but it is the
//     VIEWER's, and the day boundary is the HOST's; showing one as the
//     other would be a lie. So the UI says "this session" — true
//     regardless of date, and how lifters already talk. Never "today",
//     and never mechanism words in anything a member reads (PARADIGM §8).
//   - it cannot say which crew member is looking at it. The shell's init
//     message carries `canInvoke` but no viewer identity, so the log
//     controls are labeled "you" and the per-ship board is shown in full,
//     each row led by that member's sigil.
(function () {
  const { html, primitives, invoke, canInvoke } = surface;
  const {
    Card,
    Button,
    ListRow,
    SectionHeader,
    Stat,
    Badge,
    Avatar,
    EmptyState,
    Chart,
  } = primitives;

  const has = function (object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  };

  // ONE ENTRY PER ACTION DECLARED IN spec.json, keyed by lift id. Each
  // invoke() argument is a literal on purpose: the publish gate
  // cross-references literals against the spec, so a typo here fails the
  // gate instead of shipping a button that silently does nothing. Writing
  // `invoke(id + '-ok')` reads better and turns that check off for the
  // whole app.
  //
  // Adding a lift is three edits the gate keeps consistent: the lift in
  // `initialState.lifts` (plus `liftOrder` and the workout it belongs to),
  // its two actions in spec.json, and its line here. A lift with no line
  // renders disabled buttons — visibly inert rather than quietly dead.
  const LOG = {
    squat: {
      ok: function () {
        return invoke('squat-ok');
      },
      fail: function () {
        return invoke('squat-fail');
      },
    },
    bench: {
      ok: function () {
        return invoke('bench-ok');
      },
      fail: function () {
        return invoke('bench-fail');
      },
    },
    row: {
      ok: function () {
        return invoke('row-ok');
      },
      fail: function () {
        return invoke('row-fail');
      },
    },
    ohp: {
      ok: function () {
        return invoke('ohp-ok');
      },
      fail: function () {
        return invoke('ohp-fail');
      },
    },
    deadlift: {
      ok: function () {
        return invoke('deadlift-ok');
      },
      fail: function () {
        return invoke('deadlift-fail');
      },
    },
  };

  const clearMine = function () {
    return invoke('clear-today');
  };

  /* ---------------------------------------------------------------- */
  /* weights: integer tenths of a kg                                   */
  /*                                                                   */
  /* Deload is a multiplication, and 25 * 0.9 is 22.499999999999996 in */
  /* IEEE754 — floored to a 2.5 kg plate that silently becomes 20 kg   */
  /* instead of 22.5. Every weight is therefore carried as an integer  */
  /* number of tenths and only divided for display.                    */
  /* ---------------------------------------------------------------- */

  const tenths = function (kg) {
    return Math.round((typeof kg === 'number' ? kg : 0) * 10);
  };

  const kg = function (value) {
    return value / 10;
  };

  const formatWeight = function (value, unit) {
    return String(value) + ' ' + (unit || 'kg');
  };

  /* ---------------------------------------------------------------- */
  /* derivation                                                        */
  /* ---------------------------------------------------------------- */

  /** Archived dates, oldest first. ISO dates sort lexicographically. */
  const datesOf = function (state) {
    return Object.keys(state.history || {}).sort();
  };

  /** Every ship that appears anywhere in the log. */
  const shipsOf = function (state) {
    const seen = {};
    const history = state.history || {};
    for (const date of Object.keys(history)) {
      for (const ship of Object.keys(history[date] || {})) {
        seen[ship] = true;
      }
    }
    for (const ship of Object.keys(state.today || {})) {
      seen[ship] = true;
    }
    return Object.keys(seen).sort();
  };

  /**
   * Which of the declared workouts a logged session is, by best overlap:
   * lifts that belong score, lifts that do not subtract. A squat-only
   * session is genuinely ambiguous and reports null rather than guessing.
   */
  const workoutOf = function (state, session) {
    const workouts = state.workouts || {};
    let best = null;
    let bestScore = 0;
    for (const name of Object.keys(workouts)) {
      const members = workouts[name] || [];
      let score = 0;
      for (const id of members) {
        if (has(session, id)) {
          score += 1;
        }
      }
      for (const id of Object.keys(session)) {
        if (members.indexOf(id) === -1) {
          score -= 1;
        }
      }
      if (best === null || score > bestScore) {
        best = name;
        bestScore = score;
      }
    }
    return bestScore > 0 ? best : null;
  };

  /**
   * Replays one ship's archived history to derive what the program says
   * they should be lifting next. Nothing here is stored; the log is.
   *
   * `/today` is deliberately NOT replayed: a session in progress has not
   * been saved by the host yet, so the weight shown is the weight to lift
   * right now, and it only advances once the host saves the session.
   */
  const progressionFor = function (state, ship) {
    const lifts = state.lifts || {};
    const deloadAfter = state.deloadAfter || 3;
    const factor =
      typeof state.deloadFactor === 'number' ? state.deloadFactor : 0.9;
    const step = tenths(state.plateStep || 2.5);
    const floorAt = tenths(state.barWeight || 20);

    const weight = {};
    const streak = {};
    const deloads = {};
    const series = {};
    for (const id of Object.keys(lifts)) {
      weight[id] = tenths((lifts[id] || {}).start);
      streak[id] = 0;
      deloads[id] = 0;
      series[id] = [];
    }

    let last = null;
    let sessions = 0;
    for (const date of datesOf(state)) {
      const session = (state.history[date] || {})[ship];
      if (!session) {
        continue;
      }
      sessions += 1;
      for (const id of Object.keys(session)) {
        if (!has(weight, id)) {
          continue;
        }
        const ok = (session[id] || {}).r === 'ok';
        // the weight that was ON THE BAR that day, recorded before the
        // session's own outcome moves it
        series[id].push({ date: date, weight: kg(weight[id]), ok: ok });
        if (ok) {
          weight[id] = weight[id] + tenths((lifts[id] || {}).inc || 2.5);
          streak[id] = 0;
          continue;
        }
        streak[id] += 1;
        if (streak[id] >= deloadAfter) {
          const target = Math.round(weight[id] * factor);
          weight[id] = Math.max(floorAt, Math.floor(target / step) * step);
          streak[id] = 0;
          deloads[id] += 1;
        }
      }
      last = workoutOf(state, session) || last;
    }

    const working = {};
    for (const id of Object.keys(weight)) {
      working[id] = kg(weight[id]);
    }
    return {
      working: working,
      streak: streak,
      deloads: deloads,
      series: series,
      last: last,
      next: last === 'A' ? 'B' : 'A',
      sessions: sessions,
    };
  };

  const outcomeOf = function (bucket, ship, liftId) {
    const session = (bucket || {})[ship];
    if (!session || !has(session, liftId)) {
      return null;
    }
    return (session[liftId] || {}).r === 'ok' ? 'ok' : 'fail';
  };

  /** "no sessions yet" reads better than "0 sessions" on a fresh board. */
  const sessionCount = function (count) {
    return count === 0 ? 'no sessions yet' : String(count) + ' sessions';
  };

  /**
   * One line of "Squat 20 kg · Bench Press 22.5 kg". Joined rather than
   * emitted per lift with a trailing separator, which leaves a dangling
   * "·" at the end of every crew row.
   */
  const weightLine = function (order, lifts, working, unit) {
    return order
      .map(function (id) {
        const label = (lifts[id] || {}).label || id;
        return label + ' ' + formatWeight(working[id], unit);
      })
      .join(' · ');
  };

  const MARK = { ok: '✓', fail: '✗' };

  const markOf = function (outcome) {
    return outcome === null ? '·' : MARK[outcome];
  };

  /* ---------------------------------------------------------------- */
  /* chart                                                             */
  /* ---------------------------------------------------------------- */

  // The shell's `Chart` primitive owns the container, the canvas and the
  // Chart.js instance, so this app hands it a series and nothing else: no
  // width, no height, no colors. Series colors come from the shell's token
  // variables in declaration order, and the axes, grid and legend follow
  // the host theme — so no color literal appears in this bundle either.
  const chartData = function (state, ships, progress) {
    const dates = datesOf(state);
    const liftId = state.chartLift || 'squat';

    const datasets = ships.map(function (ship) {
      const byDate = {};
      for (const point of progress[ship].series[liftId] || []) {
        byDate[point.date] = point.weight;
      }
      return {
        label: ship,
        data: dates.map(function (date) {
          return has(byDate, date) ? byDate[date] : null;
        }),
        borderWidth: 2,
        pointRadius: 3,
        spanGaps: true,
        tension: 0,
      };
    });

    return { labels: dates, datasets: datasets };
  };

  /* ---------------------------------------------------------------- */
  /* render                                                            */
  /* ---------------------------------------------------------------- */

  surface.register({
    render(state) {
      const lifts = state.lifts || {};
      const order = state.liftOrder || Object.keys(lifts);
      const unit = state.unit || 'kg';
      const today = state.today || {};
      const ships = shipsOf(state);
      const dates = datesOf(state);

      if (order.length === 0) {
        return html`<${EmptyState}
          title="No lifts yet"
          description="This board has no lifts to track."
        />`;
      }

      const progress = {};
      for (const ship of ships) {
        progress[ship] = progressionFor(state, ship);
      }

      let logged = 0;
      for (const ship of Object.keys(today)) {
        logged += Object.keys(today[ship] || {}).length;
      }

      const chartable = dates.length > 0;

      return html`
        <${Card} title=${state.program || 'Workout'}>
          <div data-testid="workout-summary">
            <${Stat}
              value=${String(dates.length)}
              label="sessions completed"
              hint=${state.progression || ''}
            />
            <${Stat} value=${String(logged)} label="logged this session" />
          </div>

          <${SectionHeader}>Log your session<//>
          ${order.map(function (id) {
            const lift = lifts[id] || {};
            const log = LOG[id] || {};
            return html`
              <${ListRow}
                right=${html`
                  <div style="display: flex; gap: var(--space-m)">
                    <${Button}
                      tone="positive"
                      disabled=${!canInvoke() || !log.ok}
                      onPress=${log.ok}
                    >
                      ${'All reps'}
                    <//>
                    <${Button}
                      tone="negative"
                      disabled=${!canInvoke() || !log.fail}
                      onPress=${log.fail}
                    >
                      ${'Missed'}
                    <//>
                  </div>
                `}
                secondary=${html`
                  <div data-testid=${'workout-lift-' + id}>
                    ${ships.map(function (ship) {
                      return html`<span
                        >${' ' + ship + ' '}${formatWeight(
                          progress[ship].working[id],
                          unit
                        )}${' ' +
                        markOf(outcomeOf(today, ship, id)) +
                        ' '}</span
                      >`;
                    })}
                  </div>
                `}
              >
                <div>
                  ${lift.label || id} <${Badge}>${lift.scheme || ''}<//>
                </div>
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
              ${'Mis-tapped? This clears only your own entries for this session.'}
            </div>
          <//>
        <//>

        <${Card} title="Crew">
          ${ships.length === 0
            ? html`<${EmptyState} title="Nobody has logged a lift yet" />`
            : ships.map(function (ship) {
                const derived = progress[ship];
                return html`
                  <${ListRow}
                    left=${html`<${Avatar} ship=${ship} />`}
                    right=${html`<${Badge}>${'Next: ' + derived.next}<//>`}
                    secondary=${html`
                      <div>
                        ${weightLine(order, lifts, derived.working, unit)}
                      </div>
                      <div>
                        ${order.map(function (id) {
                          if (derived.deloads[id] > 0) {
                            return html`<${Badge} tone="negative"
                              >${(lifts[id] || {}).label +
                              ' deloaded ×' +
                              String(derived.deloads[id])}<//
                            >`;
                          }
                          if (derived.streak[id] > 0) {
                            return html`<${Badge} tone="negative"
                              >${(lifts[id] || {}).label +
                              ' ' +
                              String(derived.streak[id]) +
                              ' missed'}<//
                            >`;
                          }
                          return null;
                        })}
                      </div>
                    `}
                  >
                    <div data-testid=${'workout-ship-' + ship}>
                      ${ship}${' — '}${sessionCount(derived.sessions)}
                    </div>
                  <//>
                `;
              })}
        <//>

        <${Card}
          title=${'Working weight over time — ' +
          ((lifts[state.chartLift || 'squat'] || {}).label || '')}
        >
          ${chartable
            ? html`<div data-testid="workout-chart-host">
                <${Chart}
                  type="line"
                  label="Working weight over time"
                  data=${chartData(state, ships, progress)}
                />
              </div>`
            : html`<${EmptyState}
                title="Nothing to chart yet"
                description="Your past sessions will appear here."
              />`}
        <//>

        <${Card} title="Past sessions">
          ${dates.length === 0
            ? html`<${EmptyState}
                title="No sessions saved yet"
                description="Your finished sessions will be listed here."
              />`
            : dates
                .slice()
                .reverse()
                .slice(0, state.historyShown || 6)
                .map(function (date) {
                  const day = state.history[date] || {};
                  return html`
                    <${ListRow}>
                      <div data-testid=${'workout-history-' + date}>
                        <div>${date}</div>
                        ${Object.keys(day)
                          .sort()
                          .map(function (ship) {
                            const session = day[ship] || {};
                            return html`<div>
                              <${Avatar} ship=${ship} />
                              ${' ' + ship + ' '}<${Badge}
                                >${workoutOf(state, session) || '?'}<//
                              >
                              ${order.map(function (id) {
                                if (!has(session, id)) {
                                  return null;
                                }
                                return html`<span
                                  >${' ' +
                                  (lifts[id] || {}).label +
                                  ' '}${markOf(
                                    (session[id] || {}).r === 'ok'
                                      ? 'ok'
                                      : 'fail'
                                  )}</span
                                >`;
                              })}
                            </div>`;
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
