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
// Instead, in order, stopping at the first result that fits: serialize the
// params compactly and verbatim; shrink individual values; drop the keys the
// model left empty, reporting how many; describe the shape. Every path returns
// parseable JSON that is within budget, or undefined.

export const MAX_TOOL_PARAM_DETAIL_CHARS = 2000;
// Values longer than this are elided individually. Generous enough to keep the
// identifying arguments a consumer matches on (channel ids, message bodies).
export const MAX_TOOL_PARAM_VALUE_CHARS = 200;
export const MAX_TOOL_PARAM_ARRAY_ITEMS = 10;
const MAX_TOOL_PARAM_DEPTH = 4;
const MAX_SHAPE_KEYS = 40;
const MAX_SHAPE_KEY_NAME_CHARS = 40;

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

// Describes params we could not fit, as JSON that is itself guaranteed to fit.
// Key names can be arbitrarily long, so clamp each one and halve the list until
// the document is within budget — an oversized summary would be sliced again by
// the ship-sync layer, recreating the unparseable record this module exists to
// prevent.
function shapeSummary(params: unknown, size: number): string | undefined {
  if (!isPlainRecord(params)) {
    return safeStringify({ __tooLarge__: size });
  }
  const keyCount = Object.keys(params).length;
  const names = Object.keys(params).map((key) =>
    key.length > MAX_SHAPE_KEY_NAME_CHARS
      ? `${key.slice(0, MAX_SHAPE_KEY_NAME_CHARS)}…`
      : key
  );
  for (
    let shown = Math.min(names.length, MAX_SHAPE_KEYS);
    shown > 0;
    shown = Math.floor(shown / 2)
  ) {
    const candidate = safeStringify({
      __tooLarge__: size,
      keyCount,
      keys: names.slice(0, shown),
    });
    if (candidate && candidate.length <= MAX_TOOL_PARAM_DETAIL_CHARS) {
      return candidate;
    }
  }
  // Fixed-size floor: no key names at all.
  return safeStringify({ __tooLarge__: size, keyCount });
}

// Deliberately not a type predicate: narrowing the negative branch would make
// the still-useful `serialized?.length` reads below unreachable-typed.
function fits(serialized: string | undefined): boolean {
  return (
    serialized !== undefined && serialized.length <= MAX_TOOL_PARAM_DETAIL_CHARS
  );
}

// Concessions in order of what they cost a consumer, cheapest first: keys the
// model left empty carry no information beyond having been present, so drop
// those before clamping any real value. Anything that fits is returned as-is.
export function detailToolParams(params: unknown): string | undefined {
  if (params === null || params === undefined) {
    return undefined;
  }

  // 1. Everything, exactly as passed.
  const verbatim = safeStringify(params);
  if (fits(verbatim)) {
    return verbatim;
  }

  if (isPlainRecord(params)) {
    const lean = withoutEmptyToolParamValues(params);
    const omitted = Object.keys(params).length - Object.keys(lean).length;
    const marked = (value: Record<string, unknown>) =>
      omitted > 0 ? { ...value, __emptyKeysOmitted__: omitted } : value;

    // 2. Padding dropped, every remaining value still exact. Only worth trying
    //    when there was padding to drop — otherwise this is step 1 again.
    if (omitted > 0) {
      const leanVerbatim = safeStringify(marked(lean));
      if (fits(leanVerbatim)) {
        return leanVerbatim;
      }
    }

    // 3. Padding dropped and long values clamped. Strictly better than eliding
    //    with the padding still in place, so there is no all-keys elided step.
    const leanElided = safeStringify(
      marked(elideToolParamValues(lean) as Record<string, unknown>)
    );
    if (fits(leanElided)) {
      return leanElided;
    }
    return shapeSummary(params, verbatim?.length ?? leanElided?.length ?? 0);
  }

  // Non-records (an array of params) have no padding to drop. Elision also
  // breaks reference cycles, which is why this can succeed where step 1 threw.
  const elided = safeStringify(elideToolParamValues(params));
  if (!elided) {
    return undefined;
  }
  if (fits(elided)) {
    return elided;
  }
  return shapeSummary(params, elided.length);
}
