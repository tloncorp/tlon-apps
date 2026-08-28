// The F2 fixture: a spec revision bump with an UNCHANGED bundle must
// produce a fresh sandbox session, not a frozen one. The bundle is
// byte-identical across revisions on purpose — if the host keyed its
// session on the bundle hash alone, nothing would remount and the
// dashboard would keep showing the old revision's state forever.
//
// Everything on screen therefore comes from state, which resets to the new
// revision's `initialState` on a non-preserving bump: the revision label,
// the note, and the ping list. A live session shows revision 2 AND still
// accepts pings; a frozen one shows revision 1 or stops responding.
(function () {
  const { html, primitives, invoke, canInvoke } = surface;
  const { Card, Button, Stat, SectionHeader, EmptyState, Badge } = primitives;

  surface.register({
    render(state) {
      const pings = state.pings || {};
      const ships = Object.keys(pings).sort();

      return html`
        <${Card} title=${state.title || 'Revision probe'}>
          <div data-testid="revision-label">
            Rendering revision
            <${Badge}>${String(state.revision)}<//>
          </div>
          <p data-testid="revision-note">${state.note || ''}</p>
          <${SectionHeader}>Liveness<//>
          <${Button} disabled=${!canInvoke()} onPress=${() => invoke('ping')}>
            Ping
          <//>
          ${ships.length === 0
            ? html`<${EmptyState}
                title="No pings yet"
                description="Tap Ping — it should work before and after a revision bump."
              />`
            : html`<div data-testid="revision-pings">
                ${ships.map((ship) => html`<div>${ship} pinged</div>`)}
              </div>`}
          <${Stat} value=${String(ships.length)} label="pings this revision" />
        <//>
      `;
    },
  });
})();
