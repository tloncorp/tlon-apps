// The hostile-navigation fixture: the five self-navigation vectors from
// `apps/tlon-web/sandbox-posture/navigation.spec.ts`, living inside a real
// surface channel instead of a synthetic harness page.
//
// The posture suite measures these against a controlled host page. This
// fixture measures them against the SHIPPING host page, which is the only
// place the real `frame-src` policy (and its delivery mechanism) is in
// effect. What you should see: the dashboard renders normally and stays
// rendered. Any vector that succeeds replaces the frame's document, and
// the surface visibly turns into someone else's page.
//
// Each probe reports to the parent before it fires, exactly as the posture
// suite does, so "never armed" can never be misread as "blocked".
(function () {
  const { html, primitives } = surface;
  const { Card, ListRow, Button, SectionHeader, Badge } = primitives;

  // A localhost origin the seed's bundle server also answers on. Reaching
  // it at all is the egress — the response body is irrelevant.
  const TARGET =
    (typeof window !== 'undefined' && window.__SURFACE_SEED_ATTACKER__) ||
    'http://127.0.0.1:4322/stolen';

  function arm(name) {
    try {
      parent.postMessage(
        JSON.stringify({ type: 'seed-probe-armed', probe: name }),
        '*'
      );
    } catch (_e) {
      // a blocked postMessage must not stop the probe from firing
    }
  }

  const PROBES = {
    // the bare identifier — inside the bundle's scope this resolves to the
    // host's in-realm shim, not to the real Location
    'nav-replace': function () {
      arm('nav-replace');
      location.replace(TARGET);
    },
    'nav-href': function () {
      arm('nav-href');
      location.href = TARGET;
    },
    // the same underlying API reached through an object: the shim shadows
    // an IDENTIFIER, so this gets the real, unforgeable Location
    'nav-window-location': function () {
      arm('nav-window-location');
      window.location.replace(TARGET);
    },
    'nav-anchor': function () {
      arm('nav-anchor');
      const a = document.createElement('a');
      a.href = TARGET;
      a.target = '_self';
      a.textContent = 'go';
      document.body.appendChild(a);
      a.click();
    },
    'nav-meta': function () {
      arm('nav-meta');
      document.write(
        '<meta http-equiv="refresh" content="0;url=' + TARGET + '">'
      );
    },
  };

  const NAMES = Object.keys(PROBES);

  function fire(name) {
    try {
      PROBES[name]();
    } catch (error) {
      // a throw is not containment — record it and keep the surface alive
      const box = document.querySelector('[data-testid="probe-log"]');
      if (box) {
        box.textContent = name + ' threw: ' + String(error);
      }
    }
  }

  surface.register({
    render(state) {
      return html`
        <${Card} title="Hostile navigation probes">
          <p>
            Target: <code>${TARGET}</code>. Fire a probe; if the surface is
            still here afterwards, that vector did not navigate the frame.
          </p>
          <${SectionHeader}>Vectors<//>
          ${NAMES.map(
            (name) => html`
              <${ListRow}
                right=${html`<${Button} onPress=${() => fire(name)}>Fire<//>`}
              >
                <div>
                  ${name}
                  <${Badge}
                    tone=${(state.shimmed || []).indexOf(name) === -1
                      ? 'neutral'
                      : 'positive'}
                  >
                    ${(state.shimmed || []).indexOf(name) === -1
                      ? 'unshimmed'
                      : 'in-realm shimmed'}
                  <//>
                </div>
              <//>
            `
          )}
          <${SectionHeader}>Fire all<//>
          <${Button} onPress=${() => NAMES.forEach(fire)}>Fire every vector<//>
          <div data-testid="probe-log"></div>
        <//>
      `;
    },
  });
})();
