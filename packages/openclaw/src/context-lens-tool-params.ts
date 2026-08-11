// Serializes a tool call's params for the context lens's `argumentDetail`.
//
// Consumers parse this field back into structured arguments — the tlonbot e2e
// harness evaluates fixture `args_match` predicates against it — so the one
// invariant that matters is that the output is always valid JSON. It used to be
// produced by pretty-printing the params and slicing the result at the budget,
// which fails that invariant exactly when it matters: a model that fills in
// every optional parameter (gpt-5.6-luna sends ~108 keys on a `message` call)
// overflows the budget, the document is cut mid-key, and the consumer loses
// every argument rather than the one long value that caused the overflow.
//
// Instead: serialize compactly, shrink individual values, and — if still over
// budget — drop keys the model left empty and say how many were dropped. Every
// path returns parseable JSON or undefined.

export const MAX_TOOL_PARAM_DETAIL_CHARS = 2000;
// Values longer than this are elided individually. Generous enough to keep the
// identifying arguments a consumer matches on (channel ids, message bodies).
export const MAX_TOOL_PARAM_VALUE_CHARS = 200;
export const MAX_TOOL_PARAM_ARRAY_ITEMS = 10;
const MAX_TOOL_PARAM_DEPTH = 4;
const MAX_SHAPE_KEYS = 40;

export function elideToolParamValues(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_TOOL_PARAM_VALUE_CHARS
      ? `${value.slice(0, MAX_TOOL_PARAM_VALUE_CHARS)}… [${value.length} chars]`
      : value;
  }
  if (Array.isArray(value)) {
    if (depth >= MAX_TOOL_PARAM_DEPTH) return `[array ${value.length}]`;
    const items: unknown[] = value
      .slice(0, MAX_TOOL_PARAM_ARRAY_ITEMS)
      .map((item) => elideToolParamValues(item, depth + 1));
    if (value.length > MAX_TOOL_PARAM_ARRAY_ITEMS) {
      items.push(`[+${value.length - MAX_TOOL_PARAM_ARRAY_ITEMS} more items]`);
    }
    return items;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (depth >= MAX_TOOL_PARAM_DEPTH) return `[object ${entries.length} keys]`;
    const out: Record<string, unknown> = {};
    for (const [key, nested] of entries) {
      out[key] = elideToolParamValues(nested, depth + 1);
    }
    return out;
  }
  return value;
}

// Keys the model filled in with nothing. Dropping them takes a padded
// `message` call from 108 keys to 32. `false` and `0` are kept — unlike "" and
// [], those are values a consumer may legitimately assert on.
export function withoutEmptyToolParamValues(
  params: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.length === 0) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

function safeStringify(value: unknown): string | undefined {
  try {
    // Compact on purpose: the field is machine-read, and indentation costs
    // roughly a third of the budget (2033 vs 1708 chars on a real padded call).
    return JSON.stringify(value) || undefined;
  } catch {
    // Circular or otherwise unserializable.
    return undefined;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function detailToolParams(params: unknown): string | undefined {
  if (params === null || params === undefined) {
    return undefined;
  }

  const direct = safeStringify(elideToolParamValues(params));
  if (!direct) {
    return undefined;
  }
  if (direct.length <= MAX_TOOL_PARAM_DETAIL_CHARS) {
    return direct;
  }

  // Over budget: drop the schema padding and record how much went missing.
  if (isPlainRecord(params)) {
    const lean = withoutEmptyToolParamValues(params);
    const omitted = Object.keys(params).length - Object.keys(lean).length;
    const leanSerialized = safeStringify({
      ...(elideToolParamValues(lean) as Record<string, unknown>),
      ...(omitted > 0 ? { __emptyKeysOmitted__: omitted } : {}),
    });
    if (
      leanSerialized &&
      leanSerialized.length <= MAX_TOOL_PARAM_DETAIL_CHARS
    ) {
      return leanSerialized;
    }
  }

  // Last resort: describe the shape we could not fit, still as valid JSON.
  return safeStringify(
    isPlainRecord(params)
      ? {
          __tooLarge__: direct.length,
          keys: Object.keys(params).slice(0, MAX_SHAPE_KEYS),
        }
      : { __tooLarge__: direct.length }
  );
}
