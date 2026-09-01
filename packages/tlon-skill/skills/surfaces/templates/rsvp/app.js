// RSVP — the reference app for per-member state.
//
// This is the shape to reach for FIRST, every time a member's own answer is
// the whole of what the app records: one key per member, written by an
// idempotent `set` at `/responses/$actor`, and one `del` to take it back.
// Pressing a button twice writes the same literal to the same key and
// changes nothing, so "one answer each" is true without any duplicate
// checking anywhere — no counting of posts, no de-duplication, no `append`.
//
// Three things this app deliberately does not do, because v0 cannot:
//   - it never calls `Date`. The date and the place are strings the
//     organiser wrote once and this app prints them back verbatim. The
//     sandbox has a clock, but it is the VIEWER's, so "3 days left" would
//     say something different to a member in another timezone. Nothing here
//     counts down and nothing here goes "past".
//   - it cannot say which member is looking at it. So every answer is shown
//     with the crew that gave it, each row led by that member's sigil, and
//     the controls are labelled for the viewer ("Changed your mind? This
//     clears only your own answer") rather than naming anybody.
//   - it cannot take a guest count, a note, or a name typed in. Actions
//     carry no values; the only thing a member supplies is which declared
//     button they pressed. NOTES.md says what that rules out.
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
    SectionHeader,
  } = primitives;

  // ONE ENTRY PER ANSWER DECLARED IN spec.json, keyed by the answer id it
  // belongs to. The argument to invoke() is a literal on purpose: the
  // publish gate cross-references every literal against the spec, so a typo
  // here is a gate error rather than a button that silently does nothing.
  // Build the id with `invoke('answer-' + id)` instead and that check is off
  // for the whole app, not just for that line.
  //
  // Adding an answer is therefore three edits the gate keeps consistent: the
  // entry in `initialState.answers` (plus `answerOrder`), the action in
  // spec.json, and the line here. An answer with no line renders a disabled
  // button — visibly inert rather than quietly dead.
  const ANSWER = {
    yes: function () {
      return invoke('answer-yes');
    },
    maybe: function () {
      return invoke('answer-maybe');
    },
    no: function () {
      return invoke('answer-no');
    },
  };

  const clearMine = function () {
    return invoke('clear-answer');
  };

  const has = function (object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  };

  /** A plain object, or an empty one — state is shared and may be hostile. */
  const objectOf = function (value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  };

  const listOf = function (value) {
    return Array.isArray(value) ? value : [];
  };

  /** The ships who gave each answer, sorted so every viewer sees one order. */
  const bucketsOf = function (responses) {
    const buckets = {};
    for (const ship of Object.keys(responses).sort()) {
      const id = String(responses[ship]);
      if (!has(buckets, id)) {
        buckets[id] = [];
      }
      buckets[id].push(ship);
    }
    return buckets;
  };

  /**
   * Declared answers in the order the sheet lists them, then any answer
   * somebody is actually holding that the sheet no longer offers — dropping
   * an answer from the sheet must not drop the members who gave it.
   */
  const answerIds = function (order, buckets) {
    const seen = {};
    const ids = [];
    for (const id of order) {
      const key = String(id);
      if (!has(seen, key)) {
        seen[key] = true;
        ids.push(key);
      }
    }
    const leftover = [];
    for (const key of Object.keys(buckets)) {
      if (!has(seen, key)) {
        seen[key] = true;
        leftover.push(key);
      }
    }
    leftover.sort();
    return ids.concat(leftover);
  };

  const labelOf = function (answers, id) {
    const answer = objectOf(answers[id]);
    return typeof answer.label === 'string' && answer.label !== ''
      ? answer.label
      : id;
  };

  const countOf = function (buckets, id) {
    return has(buckets, id) ? buckets[id].length : 0;
  };

  /**
   * Seats are whole seats. Every number this app shows is a count of people
   * or a difference between two counts, so nothing here ever divides and no
   * derived number can arrive with a rounding error in it.
   */
  const seatsLeft = function (seats, taken) {
    return seats - taken > 0 ? seats - taken : 0;
  };

  surface.register({
    render(state) {
      const answers = objectOf(state.answers);
      const responses = objectOf(state.responses);
      const buckets = bucketsOf(responses);
      const ids = answerIds(listOf(state.answerOrder), buckets);
      const headline = has(answers, state.headline)
        ? String(state.headline)
        : ids[0] || 'yes';
      const coming = countOf(buckets, headline);
      const seats = typeof state.seats === 'number' ? state.seats : 0;
      const replied = Object.keys(responses).length;

      return html`
        <${Card} title=${state.occasion || 'RSVP'}>
          <${Stat}
            value=${String(coming)}
            label=${labelOf(answers, headline)}
            hint=${replied === 0
              ? 'Tap Yes, Maybe or No to answer.'
              : 'You can change your answer any time.'}
          />

          <${ListRow}
            right=${seats > 0
              ? html`<${Badge}
                  tone=${seatsLeft(seats, coming) === 0
                    ? 'negative'
                    : 'neutral'}
                  >${String(seatsLeft(seats, coming)) + ' seats left'}<//
                >`
              : null}
            secondary=${html`<div>${state.where || ''}</div>`}
          >
            <div data-testid="rsvp-details">${state.when || ''}</div>
          <//>

          <${SectionHeader}>Your answer<//>
          ${ids.map(function (id) {
            const answer = objectOf(answers[id]);
            return html`
              <${ListRow}
                right=${html`
                  <${Button}
                    tone=${answer.tone || 'neutral'}
                    disabled=${!canInvoke() || !has(ANSWER, id)}
                    onPress=${ANSWER[id]}
                  >
                    ${answer.button || labelOf(answers, id)}
                  <//>
                `}
              >
                <div data-testid=${'rsvp-answer-' + id}>
                  ${labelOf(answers, id)}
                  <${Badge}>${String(countOf(buckets, id))}<//>
                </div>
              <//>
            `;
          })}

          <${ListRow}
            right=${html`
              <${Button} disabled=${!canInvoke()} onPress=${clearMine}>
                Clear
              <//>
            `}
          >
            <div>${'Changed your mind? This clears only your own answer.'}</div>
          <//>
        <//>

        <${Card} title="Who said what">
          ${replied === 0
            ? html`<${EmptyState}
                title="Nobody has answered yet"
                description="Say yes, maybe or no above and your name appears here."
              />`
            : ids.map(function (id) {
                const crew = has(buckets, id) ? buckets[id] : [];
                if (crew.length === 0) {
                  return null;
                }
                return html`
                  <div data-testid=${'rsvp-crew-' + id}>
                    <${SectionHeader}
                      >${labelOf(answers, id) + ' · ' + String(crew.length)}<//
                    >
                    ${crew.map(function (ship) {
                      return html`
                        <${ListRow} left=${html`<${Avatar} ship=${ship} />`}>
                          <div data-testid=${'rsvp-guest-' + ship}>${ship}</div>
                        <//>
                      `;
                    })}
                  </div>
                `;
              })}
        <//>
      `;
    },
  });
})();
