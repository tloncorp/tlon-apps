import type { NativeSampledRulerContract } from './scrollNativeGeometry';
import { isNativeReadTimingSession } from '../ui/components/Channel/PostList/nativeReadMetadata';

export const automatedScrollScenarios: readonly string[] = [
  'entry-latest',
  'entry-selected',
  'entry-delayed',
  'empty-first-post',
  'append-end',
  'append-history',
  'burst-end',
  'burst-history',
  'prepend-history',
  'stateful-image-load-history',
  'stateful-image-load-end',
  'thinking-empty-show-hide',
  ...['end', 'history'].flatMap((position) => [
    `thinking-show-hide-${position}`,
    `thinking-label-${position}`,
    `thinking-handoff-message-first-${position}`,
    `thinking-handoff-same-frame-${position}`,
    `thinking-handoff-hide-first-${position}`,
  ]),
  ...['near', 'history'].flatMap((position) =>
    [
      'grow',
      'shrink',
      'media',
      'reference',
      'remove',
      'reaction',
      'reply',
      'cache',
    ].map((kind) => `${position}-${kind}`)
  ),
];

/** Declare the requested core suite, preserving order and rejecting omissions. */
export function selectFixtureSuiteScenarios(
  names?: string | readonly string[] | null
): string[] {
  if (names === undefined || names === null)
    return [...automatedScrollScenarios];
  const selected = typeof names === 'string' ? names.split(',') : [...names];
  if (
    !selected.length ||
    new Set(selected).size !== selected.length ||
    selected.some((name) => !automatedScrollScenarios.includes(name))
  )
    throw new Error(
      'Suite scenarios must be nonempty, unique known core names'
    );
  return selected;
}

/** A selection may only dispatch through the declared core suite route. */
export function parseFixtureSuiteRequest(
  params: Pick<URLSearchParams, 'get' | 'has' | 'getAll'>
) {
  if (
    params.getAll('suite').length > 1 ||
    params.getAll('scenarios').length > 1
  )
    throw new Error('Suite selection parameters must be declared exactly once');
  const suite = params.get('suite');
  if (suite === null && !params.has('scenarios')) return undefined;
  if (suite !== 'core')
    throw new Error('A scenario selection requires suite=core');
  return selectFixtureSuiteScenarios(params.get('scenarios'));
}

/** Private dependency observation is explicitly requested for a core suite. */
export function parseFixtureCorrectionDiagnostics(params: URLSearchParams) {
  if (!params.has('diagnostics')) return false;
  if (
    params.getAll('diagnostics').length !== 1 ||
    params.get('diagnostics') !== 'corrections' ||
    params.get('suite') !== 'core'
  )
    throw new Error(
      'Correction diagnostics require diagnostics=corrections and suite=core'
    );
  return true;
}

/** Timings are optional diagnostics, independent of scenario qualification. */
export function parseFixtureNativeReadTimingSession(params: URLSearchParams) {
  if (!params.has('nativeReadTimingSession')) return undefined;
  const session = params.get('nativeReadTimingSession');
  if (
    params.getAll('nativeReadTimingSession').length !== 1 ||
    !isNativeReadTimingSession(session)
  )
    throw new Error('Native reading timings require one valid session token');
  return session;
}

const additionalSingleOwnerScenarios = [
  'command-center',
  'command-offscreen',
  'armed-growth',
  'keyboard',
  'keyboard-history',
  'keyboard-end',
  'composer-history',
  'composer-end',
  'dismiss-history',
  'gesture',
  'armed-thinking-keyboard-end',
  'armed-thinking-keyboard-history',
  'armed-thinking-gesture',
  'armed-post-gesture-thinking-end',
  'armed-post-gesture-thinking-away',
  'armed-image-load-gesture',
  'armed-image-load-keyboard-end',
  'armed-image-load-keyboard-history',
  'armed-image-load-composer-end',
  'armed-image-load-composer-history',
];

/** Only known ordinary runs may adopt the fixed native owner contract. */
export function declareFixtureSampledRuler(
  platform: string,
  scenario: string,
  owner: Omit<NativeSampledRulerContract, 'version'>
): NativeSampledRulerContract | undefined {
  if (
    platform !== 'ios' ||
    scenario.startsWith('entry-') ||
    (!automatedScrollScenarios.includes(scenario) &&
      !additionalSingleOwnerScenarios.includes(scenario))
  )
    return undefined;
  if (Object.values(owner).some((value) => typeof value !== 'string' || !value))
    throw new Error(
      'The sampled ruler requires the exact current native owner before capture'
    );
  return { version: 'indexed-cell-and-surfaces-v2', ...owner };
}
