import type { JsonObject, SurfaceSpec } from '@tloncorp/api';
import type * as db from '@tloncorp/shared/db';

import { SurfaceLoadingState } from './SurfaceStates';

/**
 * Placeholder for the live sandbox: replaced by the real platform hosts in
 * the sandbox-host step. Keeping the renderer's 'ready' arm compiling lets
 * the states land (and be reviewed) first, per the session sequencing.
 */
export function SurfaceSandboxContainer(_props: {
  channel: db.Channel;
  spec: SurfaceSpec;
  state: JsonObject;
  bundleSource: string;
}) {
  return <SurfaceLoadingState />;
}
