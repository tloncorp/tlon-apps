/**
 * Virtual-identity (bot moon) mode.
 *
 * When the skill runs inside a bot harness acting as a moon of the connected
 * ship, TLON_MOON carries the moon's @p. The product model: the bot READS as
 * the host (full access is the point), but every identity-attributed ACTION
 * (send, react, delete, profile) must carry the moon identity — never the
 * host's.
 */
import { normalizeShip } from './api-client';

/** The bot moon we're acting as, or null when running as the ship itself. */
export function botMoon(): string | null {
  const moon = (process.env.TLON_MOON ?? '').trim();
  return moon ? normalizeShip(moon) : null;
}
