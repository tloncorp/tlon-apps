// Happy-path poll. The canonical shape a template follows: a plain script,
// no imports, registering a pure render(state) against the shell's global.
// Per-user voting is idempotent by construction — each option's action is a
// `set /votes/$actor`, so a repeat vote overwrites rather than accumulating.
(function () {
  const { html, primitives, invoke, canInvoke } = surface;
  const { Card, ListRow, Button, Progress, Stat, SectionHeader, Badge } =
    primitives;

  function tally(votes) {
    const counts = {};
    for (const ship of Object.keys(votes)) {
      const choice = votes[ship];
      counts[choice] = (counts[choice] || 0) + 1;
    }
    return counts;
  }

  surface.register({
    render(state) {
      const options = state.options || [];
      const votes = state.votes || {};
      const counts = tally(votes);
      const total = Object.keys(votes).length;

      return html`
        <${Card} title=${state.question || 'Poll'}>
          ${options.map(
            (option) => html`
              <${ListRow}
                right=${html`
                  <${Button}
                    disabled=${!canInvoke()}
                    onPress=${() => invoke(option.actionId)}
                  >
                    Vote
                  <//>
                `}
              >
                <div>
                  ${option.label}
                  <${Badge}>${String(counts[option.id] || 0)}<//>
                </div>
                <${Progress}
                  value=${total === 0 ? 0 : (counts[option.id] || 0) / total}
                  label=${option.label}
                />
              <//>
            `
          )}
          <${SectionHeader}>Turnout<//>
          <${Stat} value=${String(total)} label="votes cast" />
          <div data-testid="poll-voters">
            ${Object.keys(votes)
              .sort()
              .map((ship) => html`<div>${ship} → ${votes[ship]}</div>`)}
          </div>
        <//>
      `;
    },
  });
})();
