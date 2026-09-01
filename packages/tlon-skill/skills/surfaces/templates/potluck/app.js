// Potluck sheet — per-member state with a member-supplied qualifier.
//
// The base shape is the RSVP one: one entry per member, at their own key,
// written by an idempotent `set`. What this template adds is the second
// field. A member's entry is an OBJECT under `/bringing/$actor`, and each
// field of it has its own action:
//
//     set /bringing/$actor/course  "mains"     ← which course
//     set /bringing/$actor/veg     true        ← the marker
//     del /bringing/$actor/veg                 ← taking it back
//     del /bringing/$actor                     ← clearing the whole entry
//
// That is the whole trick, and it is worth stating plainly because the
// obvious alternative is much worse. An action carries no values, so the
// marker cannot be typed in — it has to be a declared button. Fold the
// marker INTO the course ("mains", "mains vegetarian", "sides", "sides
// vegetarian", …) and every new marker multiplies the action list; give the
// marker its own field and every new marker costs exactly one action,
// whatever the courses are. Four courses and one marker is six actions this
// way and eight the other way; four courses and three markers is seven this
// way and thirty-two the other way, against a cap of 64.
//
// Independent fields also behave the way a member expects: marking a dish
// vegetarian does not disturb which course it is, and changing course does
// not silently drop the marker.
//
// What v0 genuinely cannot do here is the DISH NAME. There is no way for a
// member to supply "aubergine parmigiana" — the sheet records the kind of
// thing and the marker, and the name goes in the channel next to the sheet.
// NOTES.md says so out loud rather than approximating it.
//
// As everywhere: no `Date` (the date is a string whoever published the sheet
// wrote, printed back verbatim), and no viewer identity — the sheet shows
// everybody and the controls are labelled for whoever is holding the phone.
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

  // ONE ENTRY PER COURSE DECLARED IN spec.json, keyed by the course id it
  // belongs to. The argument to invoke() is a literal on purpose: the publish
  // gate cross-references every literal against the spec, so a typo here is a
  // gate error rather than a button that silently does nothing. Build the id
  // with `invoke('bring-' + id)` instead and that check is off for the whole
  // app, not just for that line.
  //
  // Adding a course is three edits the gate keeps consistent: the entry in
  // `initialState.courses` (plus `courseOrder`), the action in spec.json, and
  // the line here. A course with no line renders a disabled button — visibly
  // inert rather than quietly dead.
  const BRING = {
    mains: function () {
      return invoke('bring-mains');
    },
    sides: function () {
      return invoke('bring-sides');
    },
    drinks: function () {
      return invoke('bring-drinks');
    },
    dessert: function () {
      return invoke('bring-dessert');
    },
  };

  // The marker is one pair of actions for the whole sheet, not one pair per
  // course — that is the point of giving it its own field.
  const markMine = function () {
    return invoke('mark-veg');
  };

  const unmarkMine = function () {
    return invoke('unmark-veg');
  };

  const clearMine = function () {
    return invoke('clear-mine');
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

  /** Entries with no course yet sit in their own group at the bottom. */
  const UNDECIDED = '';

  /**
   * Which group each member's entry belongs in, keyed by course id, sorted
   * so every viewer sees one order.
   */
  const groupsOf = function (bringing) {
    const groups = {};
    for (const ship of Object.keys(bringing).sort()) {
      const entry = objectOf(bringing[ship]);
      const course =
        typeof entry.course === 'string' && entry.course !== ''
          ? entry.course
          : UNDECIDED;
      if (!has(groups, course)) {
        groups[course] = [];
      }
      groups[course].push(ship);
    }
    return groups;
  };

  /**
   * Declared courses in sheet order, then any course somebody is holding
   * that the sheet no longer offers — dropping a course must not drop the
   * members who signed up for it — and the undecided group last.
   */
  const groupIds = function (order, groups) {
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
    for (const key of Object.keys(groups)) {
      if (key !== UNDECIDED && !has(seen, key)) {
        seen[key] = true;
        leftover.push(key);
      }
    }
    leftover.sort();
    return ids.concat(leftover, [UNDECIDED]);
  };

  const labelOf = function (courses, id) {
    if (id === UNDECIDED) {
      return 'Not decided yet';
    }
    const course = objectOf(courses[id]);
    return typeof course.label === 'string' && course.label !== ''
      ? course.label
      : id;
  };

  const wantOf = function (courses, id) {
    const want = objectOf(courses[id]).want;
    return typeof want === 'number' && want > 0 ? Math.floor(want) : 0;
  };

  const crewOf = function (groups, id) {
    return has(groups, id) ? groups[id] : [];
  };

  /**
   * Every number on this sheet is a count of people or a difference between
   * two counts, so nothing here divides and no shown number can arrive with
   * a rounding error in it.
   */
  const shortOf = function (want, signedUp) {
    return want - signedUp > 0 ? want - signedUp : 0;
  };

  /**
   * How many more dishes the sheet is asking for, across every course.
   *
   * A per-course breakdown lived here for one round and had to go: spelled
   * out ("Mains 4 · Sides 3 · Drinks 2 · Dessert 2") it was far too long for
   * the slot it sat in and squeezed the line beside it to one word per line
   * on a phone. Every course row already carries its own "1 of 4", so the
   * summary only ever needed to be the total.
   */
  const stillWanted = function (order, courses, groups) {
    let total = 0;
    for (const id of order) {
      total += shortOf(wantOf(courses, id), crewOf(groups, id).length);
    }
    return total;
  };

  const isMarked = function (bringing, ship) {
    return objectOf(bringing[ship]).veg === true;
  };

  surface.register({
    render(state) {
      const courses = objectOf(state.courses);
      const bringing = objectOf(state.bringing);
      const groups = groupsOf(bringing);
      const declared = listOf(state.courseOrder).map(String);
      const ids = groupIds(declared, groups);
      const signedUp = Object.keys(bringing).length;
      const markLabel = state.markLabel || 'Vegetarian';
      const wanted = stillWanted(declared, courses, groups);

      return html`
        <${Card} title=${state.occasion || 'Potluck'}>
          <${Stat}
            value=${String(signedUp)}
            label="bringing something"
            hint=${signedUp === 0
              ? 'Pick a course below and your name goes on the sheet.'
              : 'You can change what you are bringing any time.'}
          />

          <${ListRow}
            right=${wanted === 0
              ? html`<${Badge} tone="positive">Nothing missing<//>`
              : html`<${Badge}>${String(wanted) + ' more wanted'}<//>`}
            secondary=${html`<div>${state.where || ''}</div>`}
          >
            <div data-testid="potluck-details">${state.when || ''}</div>
          <//>

          <${SectionHeader}>What are you bringing?<//>
          ${declared.map(function (id) {
            const want = wantOf(courses, id);
            const taken = crewOf(groups, id).length;
            return html`
              <${ListRow}
                right=${html`
                  <${Button}
                    disabled=${!canInvoke() || !has(BRING, id)}
                    onPress=${BRING[id]}
                  >
                    I'll bring
                  <//>
                `}
              >
                <div data-testid=${'potluck-course-' + id}>
                  ${labelOf(courses, id)}
                  <${Badge}
                    tone=${want > 0 && taken >= want ? 'positive' : 'neutral'}
                    >${want > 0
                      ? String(taken) + ' of ' + String(want)
                      : String(taken)}<//
                  >
                </div>
              <//>
            `;
          })}

          <${ListRow}
            right=${html`
              <div style="display: flex; gap: var(--space-m)">
                <${Button}
                  tone="positive"
                  disabled=${!canInvoke()}
                  onPress=${markMine}
                >
                  Yes
                <//>
                <${Button} disabled=${!canInvoke()} onPress=${unmarkMine}>
                  No
                <//>
              </div>
            `}
          >
            <div>${state.markQuestion || 'Is yours vegetarian?'}</div>
          <//>

          <${ListRow}
            right=${html`
              <${Button} disabled=${!canInvoke()} onPress=${clearMine}>
                Clear
              <//>
            `}
          >
            <div>${'Not coming after all? This clears only your own row.'}</div>
          <//>
        <//>

        <${Card} title="On the sheet">
          ${signedUp === 0
            ? html`<${EmptyState}
                title="Nobody has signed up yet"
                description="Pick a course above and your name appears here."
              />`
            : ids.map(function (id) {
                const crew = crewOf(groups, id);
                if (crew.length === 0) {
                  return null;
                }
                const want = wantOf(courses, id);
                return html`
                  <div data-testid=${'potluck-group-' + (id || 'undecided')}>
                    <${SectionHeader}
                      >${want > 0
                        ? labelOf(courses, id) +
                          ' · ' +
                          String(crew.length) +
                          ' of ' +
                          String(want)
                        : labelOf(courses, id) + ' · ' + String(crew.length)}<//
                    >
                    ${crew.map(function (ship) {
                      return html`
                        <${ListRow}
                          left=${html`<${Avatar} ship=${ship} />`}
                          right=${isMarked(bringing, ship)
                            ? html`<${Badge} tone="positive">${markLabel}<//>`
                            : null}
                        >
                          <div data-testid=${'potluck-member-' + ship}>
                            ${ship}
                          </div>
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
