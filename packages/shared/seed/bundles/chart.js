// Chart.js app. This is the first fixture that actually asks a real 2D
// canvas context to draw — happy-dom returns `null` from
// `canvas.getContext('2d')`, so every chart assertion up to now has been
// exercising Chart.js's degrade-cleanly path, never its render path.
//
// Charting from a pure `render(state)`: the app hands the shell's `Chart`
// primitive data and options and nothing else. The primitive owns the
// container, the canvas node and the Chart.js instance, so this bundle
// names no width, no height and no colors — the chart fills whatever the
// card gives it and draws in the host theme's tokens.
(function () {
  const { html, primitives, invoke, canInvoke } = surface;
  const { Card, Button, ListRow, SectionHeader, Stat, EmptyState, Chart } =
    primitives;

  function counts(state) {
    const tally = {};
    for (const label of state.labels || []) {
      tally[label] = 0;
    }
    const entries = state.entries || {};
    for (const ship of Object.keys(entries)) {
      const label = entries[ship];
      if (label in tally) {
        tally[label] += 1;
      }
    }
    return tally;
  }

  surface.register({
    render(state) {
      const labels = state.labels || [];
      const tally = counts(state);
      const data = labels.map((label) => tally[label]);
      const total = data.reduce((a, b) => a + b, 0);

      if (labels.length === 0) {
        return html`<${EmptyState} title="Nothing to chart" />`;
      }

      return html`
        <${Card} title=${state.title || 'Chart'}>
          <div data-testid="surface-chart-host">
            <${Chart}
              type="bar"
              label=${state.title || 'Chart'}
              data=${{
                labels: labels,
                datasets: [
                  { label: state.seriesLabel || 'Responses', data: data },
                ],
              }}
              options=${{
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
              }}
            />
          </div>
          <${SectionHeader}>Add a data point<//>
          ${labels.map(
            (label) => html`
              <${ListRow}
                right=${html`
                  <${Button}
                    disabled=${!canInvoke()}
                    onPress=${() => invoke('pick-' + label.toLowerCase())}
                  >
                    Pick
                  <//>
                `}
              >
                <div>${label} — ${String(tally[label])}</div>
              <//>
            `
          )}
          <${Stat} value=${String(total)} label="data points" />
        <//>
      `;
    },
  });
})();
