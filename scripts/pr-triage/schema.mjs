// Shared by Codex's structured output and the deterministic publisher.
const string = { type: 'string', minLength: 1, maxLength: 12000 };
const strings = { type: 'array', items: string, maxItems: 100 };
const choice = (...values) => ({ type: 'string', enum: values });
const object = (properties) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const rating = object({
  level: choice('low', 'medium', 'high'),
  reason: string,
});
export const schema = object({
  headSha: { type: 'string', pattern: '^[a-f0-9]{40}$' },
  outcome: choice(
    'human-required',
    'incomplete',
    'agent-work-needed',
    'agent-eligible'
  ),
  summary: string,
  complexity: rating,
  sensitivity: rating,
  evidence: choice('sufficient', 'partial', 'missing'),
  checks: strings,
  gaps: strings,
  agentWork: strings,
  impactMap: {
    type: 'array',
    maxItems: 100,
    items: object({
      behavior: string,
      changedPaths: { ...strings, minItems: 1 },
      trace: string,
      consumers: strings,
      boundaries: strings,
      validation: string,
      gaps: strings,
    }),
  },
  requirements: object({
    status: choice('assessed', 'not-found', 'unavailable'),
    sources: strings,
    summary: string,
    items: {
      type: 'array',
      maxItems: 100,
      items: object({
        requirement: string,
        source: string,
        status: choice('met', 'unmet', 'unclear'),
        evidence: string,
        nextStep: string,
      }),
    },
  }),
  reviewCoverage: {
    type: 'array',
    maxItems: 500,
    items: object({
      url: string,
      findingCount: { type: 'integer', minimum: 0 },
      reason: string,
    }),
  },
  findings: {
    type: 'array',
    maxItems: 150,
    items: object({
      url: string,
      claim: string,
      reviewedRevision: { ...string, pattern: '^([a-f0-9]{40}|unknown)$' },
      trigger: string,
      trace: string,
      validationMethod: choice(
        'source-inspection',
        'collected-checks',
        'local-reproduction',
        'mixed',
        'none'
      ),
      verdict: choice(
        'confirmed',
        'refuted',
        'already-fixed',
        'pre-existing',
        'out-of-scope',
        'inconclusive'
      ),
      currentStatus: string,
      evidence: strings,
      counterevidence: strings,
      proofGaps: strings,
      nextStep: string,
      fixAssessment: string,
    }),
  },
  humanDecisions: {
    type: 'array',
    maxItems: 10,
    items: object({
      question: string,
      reason: string,
      evidence: string,
      // An unanchored decision stays in the summary.
      path: { type: 'string', maxLength: 500 },
      line: { type: 'integer', minimum: 0 },
      side: choice('LEFT', 'RIGHT'),
    }),
  },
});

// The schema deliberately uses a small JSON Schema subset so validation needs
// no npm install (or execution of PR dependencies) in the publishing job.
export function validate(value, rule = schema, location = 'report') {
  const fail = (message) => {
    throw new Error(`${location}: ${message}`);
  };
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      fail('expected object');
    for (const key of Object.keys(value))
      if (!Object.hasOwn(rule.properties, key)) fail(`unexpected key ${key}`);
    for (const key of rule.required) {
      if (!Object.hasOwn(value, key)) fail(`missing ${key}`);
      validate(value[key], rule.properties[key], `${location}.${key}`);
    }
  } else if (rule.type === 'array') {
    if (
      !Array.isArray(value) ||
      value.length < (rule.minItems ?? 0) ||
      value.length > rule.maxItems
    )
      fail('invalid array');
    value.forEach((item, index) =>
      validate(item, rule.items, `${location}[${index}]`)
    );
  } else if (rule.type === 'string') {
    if (
      typeof value !== 'string' ||
      value.length < (rule.minLength ?? 0) ||
      value.length > (rule.maxLength ?? Infinity) ||
      (rule.enum && !rule.enum.includes(value)) ||
      (rule.pattern && !new RegExp(rule.pattern).test(value))
    )
      fail('invalid string');
  } else if (rule.type === 'integer') {
    if (!Number.isSafeInteger(value) || value < rule.minimum)
      fail('invalid integer');
  }
}
