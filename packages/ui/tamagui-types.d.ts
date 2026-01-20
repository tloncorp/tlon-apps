/**
 * Type overrides to make Tamagui's type system less strict
 * This file addresses TypeScript errors with token values and theme properties
 */

declare module '@tamagui/core' {
  // Make all theme properties required (not possibly undefined)
  export type ThemeValueGet = {
    val: string | number;
    variable: string;
  };

  // Override getTokens to accept any token string
  export namespace GetToken {
    export type Options = {
      shift?: number;
      bounds?: [number] | [number, number];
    };
  }
}

declare module 'tamagui' {
  // Allow getTokenValue to accept any string
  export function getTokenValue(
    token: string | number | any,
    group?: string
  ): number;

  // Make VariableVal always have val property
  export type VariableVal = {
    val: string | number;
    variable?: string;
  };
}
