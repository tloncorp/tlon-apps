import { ArvosDiscussing } from '../ArvosDiscussing';

// The animation drives native SVG props from Reanimated, which isn't checked
// on web, so the web shows the still drawing.
export function AnimatedArvosDiscussing() {
  return <ArvosDiscussing width="100%" height="100%" />;
}
