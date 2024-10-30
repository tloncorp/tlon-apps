export type JSONValue = number | string; // can add more JSON-compliant types as needed

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSONValue {
  export function asString<DefaultValue>(
    value: unknown,
    defaultValue: DefaultValue
  ): string | DefaultValue {
    return typeof value === 'string' ? value : defaultValue;
  }
}
