// StrongLifts 5×5 tracker — the derived-state exemplar (plan §9).
//
// The op language has no arithmetic, so "add 2.5 kg" is not expressible as
// an op. The pattern this fixture exists to prove is that STATE HOLDS ONLY
// THE LOG and `render` derives everything else: working weight, the A/B
// alternation, consecutive-failure streaks, deload triggers and the
// weight-over-time chart are all computed here, in ordinary unrestricted
// JavaScript, from `history` + `today`.
//
// The log itself uses host-is-the-clock (§4.3, D54) rather than `append`:
// a member's action is an idempotent `set /today/$actor/<lift>` with a
// literal outcome, and the channel host posts a rollover host event that
// archives `/today` under a date it computes from its own fold and then
// deletes `/today`. A double-tap re-sets the same path to the same literal
// and changes nothing, so this template does NOT inherit §4.3's duplicate
// caveat.
//
// Two things this app deliberately does not do, because v0 cannot:
//   - it never calls `Date`. The sandbox has a clock, but it is the
//     VIEWER's, and the rollover boundary is the HOST's; showing one as
//     the other would be a lie. The scratch area is labeled "since the
//     last rollover", not "today's date".
//   - it cannot say which crew member is looking at it. The shell's init
//     message carries `canInvoke` but no viewer identity, so the log
//     controls are labeled "you" and the per-ship board is shown in full.
(function () {
  const { html, primitives, invoke, canInvoke, Chart } = surface;
  const { Card, Button, ListRow, SectionHeader, Stat, Badge, EmptyState } =
    primitives;

  const has = function (object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
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
   * been archived by the host yet, so the weight shown is the weight to
   * lift right now, and it only advances at rollover.
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

  const MARK = { ok: '✓', fail: '✗' };

  const markOf = function (outcome) {
    return outcome === null ? '·' : MARK[outcome];
  };

  /* ---------------------------------------------------------------- */
  /* chart                                                             */
  /* ---------------------------------------------------------------- */

  // Every color the chart draws with is read out of the shell's token
  // variables at render time, so the chart follows the host theme and no
  // color literal appears in this bundle.
  const SERIES_TOKENS = [
    '--color-positive-text',
    '--color-negative-text',
    '--color-text-secondary',
    '--color-text-tertiary',
  ];

  const token = function (name) {
    try {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(
        name
      );
      const value = raw == null ? '' : raw.trim();
      return value.length > 0 ? value : undefined;
    } catch (error) {
      return undefined;
    }
  };

  const chartConfig = function (state, ships, progress) {
    const dates = datesOf(state);
    const liftId = state.chartLift || 'squat';
    const grid = token('--color-border');
    const ink = token('--color-text-secondary');

    const datasets = ships.map(function (ship, index) {
      const byDate = {};
      for (const point of progress[ship].series[liftId] || []) {
        byDate[point.date] = point.weight;
      }
      const color = token(SERIES_TOKENS[index % SERIES_TOKENS.length]);
      return {
        label: ship,
        data: dates.map(function (date) {
          return has(byDate, date) ? byDate[date] : null;
        }),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 3,
        spanGaps: true,
        tension: 0,
      };
    });

    return {
      type: 'line',
      data: { labels: dates, datasets: datasets },
      options: {
        animation: false,
        responsive: false,
        plugins: { legend: { labels: { color: ink } } },
        scales: {
          x: { ticks: { color: ink }, grid: { color: grid } },
          y: { ticks: { color: ink }, grid: { color: grid } },
        },
      },
    };
  };

  // Charting from a pure `render(state)` with no hooks: the canvas carries
  // a `ref` CALLBACK whose identity changes every render, so Preact calls
  // the previous one with null (teardown) and the new one with the node
  // (setup). The single live handle is the only mutable thing in the app.
  let chart = null;
  const attach = function (config) {
    return function (node) {
      if (chart !== null) {
        chart.destroy();
        chart = null;
      }
      if (node == null) {
        return;
      }
      chart = new Chart(node, config);
    };
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
          title="No program defined"
          description="This dashboard's spec declares no lifts."
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

      const chartable = typeof Chart === 'function' && dates.length > 0;

      return html`
        <${Card} title=${state.program || 'Workout'}>
          <div data-testid="workout-summary">
            <${Stat}
              value=${String(dates.length)}
              label="sessions archived"
              hint=${state.progression || ''}
            />
            <${Stat}
              value=${String(logged)}
              label="lifts logged since the last rollover"
            />
          </div>

          <${SectionHeader}>Log your session<//>
          ${order.map(function (id) {
            const lift = lifts[id] || {};
            return html`
              <${ListRow}
                right=${html`
                  <div>
                    <${Button}
                      tone="positive"
                      disabled=${!canInvoke()}
                      onPress=${() => invoke(id + '-ok')}
                    >
                      ${'All reps'}
                    <//>
                    <${Button}
                      tone="negative"
                      disabled=${!canInvoke()}
                      onPress=${() => invoke(id + '-fail')}
                    >
                      ${'Missed'}
                    <//>
                  </div>
                `}
              >
                <div>
                  ${lift.label || id} <${Badge}>${lift.scheme || ''}<//>
                </div>
                <div data-testid=${'workout-lift-' + id}>
                  ${ships.map(function (ship) {
                    return html`<span
                      >${' ' + ship + ' '}${formatWeight(
                        progress[ship].working[id],
                        unit
                      )}${' ' + markOf(outcomeOf(today, ship, id)) + ' '}</span
                    >`;
                  })}
                </div>
              <//>
            `;
          })}
          <${ListRow}
            right=${html`
              <${Button}
                disabled=${!canInvoke()}
                onPress=${() => invoke('clear-today')}
              >
                ${'Clear'}
              <//>
            `}
          >
            <div>
              ${'Mis-tapped? Clearing removes only your own scratch entries.'}
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
                    right=${html`<${Badge}>${'Next: ' + derived.next}<//>`}
                  >
                    <div data-testid=${'workout-ship-' + ship}>
                      <div>
                        ${ship}${' — '}${String(
                          derived.sessions
                        )}${' archived sessions'}
                      </div>
                      <div>
                        ${order.map(function (id) {
                          return html`<span
                            >${' ' +
                            (lifts[id] || {}).label +
                            ' '}${formatWeight(
                              derived.working[id],
                              unit
                            )}${' · '}</span
                          >`;
                        })}
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
                <canvas
                  data-testid="workout-chart-canvas"
                  width="560"
                  height="260"
                  ref=${attach(chartConfig(state, ships, progress))}
                ></canvas>
              </div>`
            : html`<${EmptyState}
                title="Nothing to chart yet"
                description="Archived sessions appear here after the first rollover."
              />`}
        <//>

        <${Card} title="Archived sessions">
          ${dates.length === 0
            ? html`<${EmptyState}
                title="No rollover has happened yet"
                description="The channel host archives the scratch area under a date."
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
                              ${ship}${' '}<${Badge}
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
