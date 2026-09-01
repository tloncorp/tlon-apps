// Countdown — the derived-time template, and the one with ZERO ticks.
//
// Nothing in this app is scheduled. There is no timer, no cron, no host
// event after the day it is published, and no member control. The date was
// written into state once, when the board was set up; everything on screen
// that moves — the headline, the breakdown, the bar, every "in 9 days" —
// is DERIVED in `render` from `context.now`, the host's clock, handed in
// beside the state on every paint (PARADIGM.md §3).
//
// `spec.json` declares `timeDisplay: { refreshSeconds: 60 }`. That is the
// whole mechanism: the declaration is what makes the host resend `now` on
// that cadence, so the screen stays live to the minute without this bundle
// owning a single scheduled thing. Drop the declaration and `context.now`
// is the one reading the screen was opened with, and the board is frozen at
// it. There is no third option — the sandbox has a clock, but it is the
// VIEWER's, and every ordinary way of reading it is refused by the gate.
//
// THE LINE THIS TEMPLATE EXISTS TO DRAW: a date that has gone by is
// something this board may SHOW. It is not something this board may WRITE.
// "Passed" is a word worked out at paint time from a number the host handed
// in, and every viewer works it out for themselves. "Done", "closed",
// "expired" would be facts stored in state, and no value of `now` can ever
// put one there: `render` writes nothing, `invoke` carries no arguments,
// and an action's ops are fixed in the spec. If the stored data has to
// change when a date passes, that is a host event and nothing else.
// NOTES.md has the whole argument.
//
// It also means this board works with no clock at all. `context.now` is
// `null` when the host supplied nothing, and the answer to that is not an
// error box: it is the plan the host wrote down, dates and all, with the
// counting left off.
(function () {
  const { html, primitives } = surface;
  const { Card, ListRow, Badge, Avatar, Stat, Progress, EmptyState } =
    primitives;

  // No handler table, because there is nothing to invoke: this app declares
  // no actions, and `spec.json` carries the marker that says so on purpose.

  const MINUTE = 60000;
  const HOUR = 3600000;
  const DAY = 86400000;

  const objectAt = function (value) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  };

  const msAt = function (value) {
    return typeof value === 'number' && isFinite(value) ? value : null;
  };

  /* ---------------------------------------------------------------- */
  /* time, in whole units                                              */
  /*                                                                   */
  /* Epoch milliseconds are integers and every quantity below stays    */
  /* one: a floor division of an integer by a constant, subtracted     */
  /* back off before the next unit. No division reaches a displayed    */
  /* number, so nothing here can turn a member's "3 days" into         */
  /* "2.9999999 days".                                                 */
  /* ---------------------------------------------------------------- */

  const breakdown = function (ms) {
    const total = Math.max(0, Math.floor(ms));
    const days = Math.floor(total / DAY);
    const hours = Math.floor((total - days * DAY) / HOUR);
    const minutes = Math.floor((total - days * DAY - hours * HOUR) / MINUTE);
    return { days: days, hours: hours, minutes: minutes };
  };

  const plural = function (count, noun) {
    return String(count) + ' ' + noun + (count === 1 ? '' : 's');
  };

  /** The biggest unit that is not zero — the headline number. */
  const coarse = function (span) {
    if (span.days > 0) {
      return plural(span.days, 'day');
    }
    if (span.hours > 0) {
      return plural(span.hours, 'hour');
    }
    if (span.minutes > 0) {
      return plural(span.minutes, 'minute');
    }
    return null;
  };

  /** "16 days, 16 hours and 30 minutes" — units above zero, then minutes. */
  const longform = function (span) {
    const parts = [];
    if (span.days > 0) {
      parts.push(plural(span.days, 'day'));
    }
    if (span.days > 0 || span.hours > 0) {
      parts.push(plural(span.hours, 'hour'));
    }
    parts.push(plural(span.minutes, 'minute'));
    if (parts.length === 1) {
      return parts[0];
    }
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  };

  /** A dated step's badge: how far off it is, or that its date has gone by. */
  const untilLabel = function (ms) {
    if (ms <= 0) {
      return 'Passed';
    }
    const soon = coarse(breakdown(ms));
    return soon === null ? 'Right about now' : 'in ' + soon;
  };

  /**
   * How far along the wait is, as a fraction for the bar. Null whenever
   * there is no clock or the two dates do not bracket anything, so the bar
   * is left off rather than drawn at a made-up position.
   */
  const elapsedFraction = function (from, to, now) {
    if (now === null || from === null || to === null || to <= from) {
      return null;
    }
    const span = to - from;
    return Math.min(span, Math.max(0, now - from)) / span;
  };

  /**
   * The headline, and the lines under it. Four shapes, in the order they
   * arrive: no clock, still waiting, the day itself, and afterwards.
   */
  const headlineOf = function (event, targetLabel, detail, remaining) {
    const lines = [];
    let value;
    let label;

    if (remaining === null) {
      value = targetLabel || 'Not set yet';
      label = event;
    } else if (remaining > 0) {
      const span = breakdown(remaining);
      value = coarse(span) || 'Any minute now';
      label = 'until ' + event;
      lines.push(longform(span) + ' to go');
      if (targetLabel !== '') {
        lines.push(targetLabel);
      }
    } else if (remaining > -DAY) {
      value = "It's happening";
      label = event;
      if (targetLabel !== '') {
        lines.push(targetLabel);
      }
    } else {
      value = coarse(breakdown(-remaining)) || 'Just now';
      label = 'since ' + event;
      if (targetLabel !== '') {
        lines.push(targetLabel);
      }
    }

    if (detail !== '') {
      lines.push(detail);
    }
    return { value: value, label: label, lines: lines };
  };

  /* ---------------------------------------------------------------- */
  /* render                                                            */
  /* ---------------------------------------------------------------- */

  surface.register({
    // `context.now` is epoch milliseconds from the HOST, or null. It is an
    // input, not state: it arrives beside `state`, it is per-viewer like
    // the theme, and nothing worked out from it can be written back.
    render(state, context) {
      const event = typeof state.event === 'string' ? state.event : 'The day';
      const detail = typeof state.detail === 'string' ? state.detail : '';
      const targetLabel =
        typeof state.targetLabel === 'string' ? state.targetLabel : '';
      const target = msAt(state.targetMs);
      const started = msAt(state.startedMs);
      const steps = objectAt(state.steps);
      const order = Array.isArray(state.stepOrder)
        ? state.stepOrder
        : Object.keys(steps).sort();

      const now = context ? msAt(context.now) : null;
      const remaining = now === null || target === null ? null : target - now;
      const headline = headlineOf(event, targetLabel, detail, remaining);
      const fraction = elapsedFraction(started, target, now);

      return html`
        <${Card} title=${event}>
          <div data-testid="countdown-headline">
            <${Stat} value=${headline.value} label=${headline.label} />
          </div>
          ${fraction === null
            ? null
            : html`<${Progress} value=${fraction} label=${'until ' + event} />`}
          ${headline.lines.map(function (text) {
            return html`<div>${text}</div>`;
          })}
        <//>

        <${Card} title="Before then">
          ${order.length === 0
            ? html`
                <${EmptyState}
                  title="Nothing else in the diary"
                  description="Just the day itself."
                />
              `
            : order.map(function (id) {
                const step = objectAt(steps[id]);
                const at = msAt(step.atMs);
                const owner = typeof step.owner === 'string' ? step.owner : '';
                return html`
                  <${ListRow}
                    left=${owner === ''
                      ? null
                      : html`<${Avatar} ship=${owner} />`}
                    right=${now === null || at === null
                      ? null
                      : html`<${Badge}>${untilLabel(at - now)}<//>`}
                    secondary=${html`
                      <div>${step.when || ''}</div>
                      ${owner === ''
                        ? null
                        : html`<div>${'Ask ' + owner}</div>`}
                    `}
                  >
                    <div data-testid=${'countdown-step-' + id}>
                      ${step.label || id}
                    </div>
                  <//>
                `;
              })}
        <//>
      `;
    },
  });
})();
