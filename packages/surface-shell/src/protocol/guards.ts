import { HostInitMessage, HostToShellMessage, ShellSurfaceSpec } from './types';

/**
 * Dependency-free structural guards for the messages the in-sandbox shell
 * receives. The shell validates its inbound direction with these (zod
 * never ships in the artifact); the host validates ITS inbound direction
 * with the zod schemas in ./schemas.ts. Both check the same shapes —
 * protocol.test.ts holds them in agreement.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isShellSurfaceSpec(value: unknown): value is ShellSurfaceSpec {
  return (
    isPlainObject(value) &&
    typeof value.surfaceId === 'string' &&
    value.surfaceId.length > 0 &&
    typeof value.specRevision === 'number' &&
    Number.isInteger(value.specRevision) &&
    value.specRevision >= 0 &&
    (value.title === undefined || typeof value.title === 'string') &&
    isPlainObject(value.actions)
  );
}

function isTheme(value: unknown): value is 'light' | 'dark' {
  return value === 'light' || value === 'dark';
}

/**
 * A host-supplied timestamp: epoch milliseconds, finite.
 *
 * Non-finite is refused rather than coerced. `NaN` would flow straight into
 * whatever the app formats and paint "Invalid Date" on every viewer's screen,
 * and `Infinity` would do the same to a countdown — both are the host getting
 * it wrong, and a message the shell drops is a bug that stays visible as a
 * stale clock rather than one that renders garbage.
 */
function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isHostToShellMessage(
  value: unknown
): value is HostToShellMessage {
  if (!isPlainObject(value)) {
    return false;
  }
  switch (value.type) {
    case 'init':
      return (
        typeof value.protocolVersion === 'number' &&
        Number.isInteger(value.protocolVersion) &&
        isShellSurfaceSpec(value.spec) &&
        isPlainObject(value.state) &&
        isTheme(value.theme) &&
        typeof value.canInvoke === 'boolean' &&
        (value.now === undefined || isTimestamp(value.now))
      );
    case 'state':
      return isPlainObject(value.state);
    case 'theme':
      return isTheme(value.theme);
    case 'permission':
      return typeof value.canInvoke === 'boolean';
    case 'now':
      return isTimestamp(value.now);
    default:
      return false;
  }
}

export function isHostInitMessage(value: unknown): value is HostInitMessage {
  return isHostToShellMessage(value) && value.type === 'init';
}
