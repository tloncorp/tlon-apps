import { z } from 'zod';

import {
  ACTION_ID_MAX_LENGTH,
  ACTION_ID_PATTERN,
  ERROR_MESSAGE_MAX_LENGTH,
} from './types';

/**
 * The canonical zod validators for the bridge protocol (plan §9): the
 * host validates EVERY inbound postMessage from the sandbox against these
 * before acting on it. Shell→host schemas are strict — an unknown key on
 * an invoke is a capability-widening attempt and fails validation, it is
 * not stripped-and-forgiven.
 *
 * This module is host/tooling-facing and is never bundled into the
 * sandbox artifact (enforced by scripts/check-imports.mjs); the in-sandbox
 * shell uses the dependency-free guards in ./guards.ts for its own inbound
 * direction.
 */

export const ShellThemeSchema = z.enum(['light', 'dark']);

const jsonObjectSchema = z.record(z.string(), z.unknown());

/**
 * Mirrors the api's ActionId constraints; see
 * packages/api/src/client/surface/schemas.ts (ActionIdSchema).
 */
export const BridgeActionIdSchema = z
  .string()
  .min(1)
  .max(ACTION_ID_MAX_LENGTH)
  .regex(ACTION_ID_PATTERN);

export const ShellSurfaceSpecSchema = z
  .object({
    surfaceId: z.string().min(1),
    specRevision: z.number().int().nonnegative(),
    title: z.string().optional(),
    actions: z.record(z.string(), z.unknown()),
  })
  // hosts forward the full spec; the shell reads only the fields above
  .passthrough();

/** host → shell */
export const HostToShellMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    protocolVersion: z.number().int().positive(),
    spec: ShellSurfaceSpecSchema,
    // Json validity/caps are the host's (api's) responsibility upstream;
    // the protocol checks message shape.
    state: jsonObjectSchema,
    theme: ShellThemeSchema,
    canInvoke: z.boolean(),
  }),
  z.object({ type: z.literal('state'), state: jsonObjectSchema }),
  z.object({ type: z.literal('theme'), theme: ShellThemeSchema }),
  z.object({ type: z.literal('permission'), canInvoke: z.boolean() }),
]);

/** shell → host (strict: the host's inbound direction) */
export const ShellReadyMessageSchema = z
  .object({
    type: z.literal('ready'),
    shellVersion: z.number().int().positive(),
    protocolVersion: z.number().int().positive(),
  })
  .strict();

export const ShellInvokeMessageSchema = z
  .object({
    type: z.literal('invoke'),
    actionId: BridgeActionIdSchema,
    specRevision: z.number().int().nonnegative(),
  })
  .strict();

export const ShellErrorMessageSchema = z
  .object({
    type: z.literal('error'),
    phase: z.enum(['init', 'render', 'bridge']),
    message: z.string().max(ERROR_MESSAGE_MAX_LENGTH),
  })
  .strict();

export const ShellToHostMessageSchema = z.union([
  ShellReadyMessageSchema,
  ShellInvokeMessageSchema,
  ShellErrorMessageSchema,
]);
