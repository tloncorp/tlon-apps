export type ValuesOf<T> = T[keyof T];

/**
 * UnionToIntersection<A | B | C> = A & B & C
 */
export type UnionToIntersection<T> = {
  [E in T as keyof E]: E[keyof E];
};
