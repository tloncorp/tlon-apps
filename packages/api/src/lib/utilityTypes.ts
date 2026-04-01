export type ValuesOf<T> = T[keyof T];

export type Stringified<T> = string & {
  [P in keyof T]: { '_ value': T[P] };
};

export interface JSON {
  stringify<T>(
    value: T,
    replacer?: (key: string, value: any) => any,
    space?: string | number
  ): string & Stringified<T>;
  parse<T>(text: Stringified<T>, reviver?: (key: any, value: any) => any): T;
}

/**
 * UnionToIntersection<A | B | C> = A & B & C
 */
export type UnionToIntersection<T> = {
  [E in T as keyof E]: E[keyof E];
};
