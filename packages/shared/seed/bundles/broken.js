// A deliberately broken bundle: render always throws, on every call. The
// harness error boundary must catch it and paint the defined broken state
// instead of a white screen, and it must report exactly one error per
// failure streak rather than one per render.
(function () {
  surface.register({
    render() {
      throw new Error('seed fixture: render exploded on purpose');
    },
  });
})();
