export type JSONValue = number | string | boolean; // can add more JSON-compliant types as needed

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSONValue {
  export function asString<DefaultValue>(
    value: unknown,
    defaultValue: DefaultValue
  ): string | DefaultValue {
    return typeof value === 'string' ? value : defaultValue;
  }

  export function asBoolean<DefaultValue>(
    value: unknown,
    defaultValue: DefaultValue
  ): boolean | DefaultValue {
    return typeof value === 'boolean' ? value : defaultValue;
  }
}
