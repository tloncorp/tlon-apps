/**
 * The shell's major version (plan §5): specs pin `bundle.shellVersion`
 * against this. Additive changes (new primitives, new tokens) are free
 * within a major; changes to existing primitive behavior or the bridge
 * protocol bump it.
 */
export const SHELL_VERSION = 1;
