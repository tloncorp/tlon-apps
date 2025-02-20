import { Context, ContextType } from 'react';
import type { OpaqueColorValue } from 'react-native';
import type { ColorTokens, ViewStyle } from 'tamagui';

export type ColorProp = OpaqueColorValue | ColorTokens;

export type VariantsFromStyledContext<
  TContext extends Context<any>,
  TStyle = ViewStyle,
> =
  ContextType<TContext> extends Record<string, unknown>
    ? {
        [K in keyof ContextType<TContext>]-?: Record<
          Exclude<ContextType<TContext>[K], undefined>,
          TStyle
        >;
      }
    : never;

export type VariantsFromValues<
  TValues extends Record<string, unknown>,
  TStyle = ViewStyle,
> = {
  [K in keyof TValues]: TValues[K] extends string
    ? Partial<Record<TValues[K], TStyle>>
    : never;
};
