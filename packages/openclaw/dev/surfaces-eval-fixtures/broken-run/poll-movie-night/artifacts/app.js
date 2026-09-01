// Poll — the smallest complete surface app, and the one to copy first.
//
// Everything here is the default shape: state is the question, the choices
// and one entry per voter; every control is a parameterless action; the
// render is a pure function of state with no clock, no identity and no
// storage. If a new app does not need more than this, do not give it more.
//
// The one non-obvious pattern is the handler table below — read its
// comment before adding a choice.
(function () {
  const { html, primitives, invoke, canInvoke } = surface;
  const {
    Card,
    ListRow,
    Button,
    Progress,
    Stat,
    EmptyState,
    SectionHeader,
    Badge,
    Avatar,
  } = primitives;

  // ONE ENTRY PER ACTION DECLARED IN spec.json, keyed by the choice id it
  // belongs to. The argument to invoke() is a literal on purpose: the
  // publish gate cross-references every literal against the spec, so a
  // typo here is a gate error rather than a button that silently does
  // nothing. Build the id with `invoke('vote-' + option.id)` instead and
  // that check is off for the whole app.
  //
  // Adding a choice is therefore two edits that the gate keeps honest:
  // an action in spec.json, and a line here. A choice with no line renders
  // a disabled button — visibly inert rather than quietly dead.
  const VOTE = {
    ranch: function () {
      return invoke('vote-ranch');
    },
    pizza: function () {
      return invoke('vote-pizza');
    },
    tacos: function () {
      return invoke('vote-tacos');
    },
    salad: function () {
      return invoke('vote-salad');
    },
  };

  const has = function (object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  };

  /** How many voters chose each option id. */
  const tally = function (votes) {
    const counts = {};
    for (const ship of Object.keys(votes)) {
      const choice = votes[ship];
      counts[choice] = (counts[choice] || 0) + 1;
    }
    return counts;
  };

  /** The human label for a stored choice, falling back to the raw id. */
  const labelOf = function (options, id) {
    for (const option of options) {
      if (option && option.id === id) {
        return option.label || id;
      }
    }
    return String(id);
  };

  surface.register({
    render(state) {
      // State is shared, so every read defaults: one member's odd entry
      // must not throw the app for the whole group.
      const options = Array.isArray(state.options) ? state.options : [];
      const votes =
        state.votes && typeof state.votes === 'object' ? state.votes : {};
      const counts = tally(votes);
      // Sorted so the list has a stable order for everyone looking at it.
      const voters = Object.keys(votes).sort();
      const total = voters.length;

      return html`
        <${Card} title=${state.question || 'Poll'}>
          ${options.length === 0
            ? html`<${EmptyState}
                title="No choices yet"
                description="This poll has nothing to vote on."
              />`
            : options.map(function (option) {
                const id = option && option.id;
                const count = counts[id] || 0;
                return html`
                  <${ListRow}
                    right=${html`
                      <${Button}
                        disabled=${!canInvoke() || !has(VOTE, id)}
                        onPress=${VOTE[id]}
                      >
                        Vote
                      <//>
                    `}
                  >
                    <div>
                      ${(option && option.label) || id}
                      <${Badge}>${String(count)}<//>
                    </div>
                    <${Progress}
                      value=${total === 0 ? 0 : count / total}
                      label=${(option && option.label) || id}
                    />
                  <//>
                `;
              })}
          <${SectionHeader}>Turnout<//>
          <${Stat}
            value=${String(total)}
            label="votes so far"
            hint="one vote each — change yours any time"
          />
        <//>

        <${Card} title="Who has voted">
          ${total === 0
            ? html`<${EmptyState}
                title="Nobody has voted yet"
                description="Tap Vote beside a choice to put your name down."
              />`
            : voters.map(function (ship) {
                return html`
                  <${ListRow}
                    left=${html`<${Avatar} ship=${ship} />`}
                    right=${html`<${Badge}
                      >${labelOf(options, votes[ship])}<//
                    >`}
                  >
                    <div data-testid=${'poll-voter-' + ship}>${ship}</div>
                  <//>
                `;
              })}
        <//>
      `;
    },
  });
})();
