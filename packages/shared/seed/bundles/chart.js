// Chart.js app. This is the first fixture that actually asks a real 2D
// canvas context to draw — happy-dom returns `null` from
// `canvas.getContext('2d')`, so every chart assertion up to now has been
// exercising Chart.js's degrade-cleanly path, never its render path.
//
// Charting from a pure `render(state)` with no hooks: the canvas is
// declared with a `ref` CALLBACK whose identity changes on every render.
// Preact calls the previous callback with `null` and the new one with the
// node, which gives an unambiguous teardown/setup pair without any
// app-local state beyond the single live chart handle.
(function () {
  const { html, primitives, invoke, canInvoke, Chart } = surface;
  const { Card, Button, ListRow, SectionHeader, Stat, EmptyState } = primitives;

  let chart = null;

  function attach(config) {
    return function (node) {
      if (chart !== null) {
        chart.destroy();
        chart = null;
      }
      if (node == null) {
        return;
      }
      if (typeof Chart !== 'function') {
        node.parentNode.appendChild(
          Object.assign(document.createElement('div'), {
            textContent: 'Chart.js is not available in this shell',
          })
        );
        return;
      }
      chart = new Chart(node, config);
    };
  }

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

      const config = {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: state.seriesLabel || 'Responses',
              data: data,
              backgroundColor: 'rgba(99, 102, 241, 0.6)',
              borderColor: 'rgba(99, 102, 241, 1)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          animation: false,
          responsive: false,
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      };

      return html`
        <${Card} title=${state.title || 'Chart'}>
          <div data-testid="surface-chart-host">
            <canvas
              data-testid="surface-chart-canvas"
              width="560"
              height="280"
              ref=${attach(config)}
            ></canvas>
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
