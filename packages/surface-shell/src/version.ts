/**
 * The shell's major version (plan §5): specs pin `bundle.shellVersion`
 * against this. Additive changes (new primitives, new tokens) are free
 * within a major; changes to existing primitive behavior or the bridge
 * protocol bump it.
 *
 * The host-supplied `now` input did NOT bump it, and the reasoning is worth
 * keeping because "changes to the bridge protocol bump it" reads like it
 * should have. The rule is about COMPATIBILITY, not about which file moved:
 *
 * - old bundle, new shell: `render(state)` ignores a second argument it never
 *   declared, so every published app renders exactly as before.
 * - new bundle, old shell: refused already — a bundle that needs `now` is
 *   published against a spec whose `timeDisplay` an old host does not send
 *   for, so `context.now` is null and the app renders its null branch. It
 *   does not break; it just does not tick.
 * - old host, new shell: `init` without `now` is valid, `context.now` is
 *   null.
 *
 * Nothing existing changed meaning, so nothing existing needs a new pin.
 */
export const SHELL_VERSION = 1;
