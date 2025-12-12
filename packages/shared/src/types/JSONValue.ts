export type JSONValue = number | string | boolean; // can add more JSON-compliant types as needed

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
