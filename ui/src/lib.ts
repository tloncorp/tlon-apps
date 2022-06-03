
/**
 * min =< ret < max
 */
export function randInt(min: number, max: number) {
  const range = max - min;
  const rand = Math.random() * range;
  return Math.floor(Math.random()* range) + min;
}
