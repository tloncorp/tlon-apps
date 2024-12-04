export type ValuesOf<T> = T[keyof T];

type Brand = unique symbol;
export type Nominal<T, Name extends string> = T & { __nominalTypeHack: Name };
