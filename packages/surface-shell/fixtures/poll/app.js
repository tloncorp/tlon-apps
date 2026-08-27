// The canonical poll demo (plan §1): a hand-written surface app bundle in
// the exact shape templates follow — a plain script, no build step, that
// registers a pure render(state) against the shell's `surface` global and
// composes only shell primitives. Per-user voting is idempotent by
// construction: each option's action does `set /votes/$actor`.
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
  } = primitives;

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
          ${options.length === 0
            ? html`<${EmptyState} title="No options yet" />`
            : options.map(
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
                    <div class="poll-option-label">
                      ${option.label}
                      <${Badge}>${String(counts[option.id] || 0)}<//>
                    </div>
                    <${Progress}
                      value=${total === 0
                        ? 0
                        : (counts[option.id] || 0) / total}
                      label=${option.label}
                    />
                  <//>
                `
              )}
          <${SectionHeader}>Turnout<//>
          <${Stat} value=${String(total)} label="votes cast" />
        <//>
      `;
    },
  });
})();
