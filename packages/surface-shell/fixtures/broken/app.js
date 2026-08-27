// A deliberately broken bundle: render always throws. Exercises the
// harness error boundary through the same generic fixture runner.
surface.register({
  render() {
    throw new Error('fixture render exploded');
  },
});
