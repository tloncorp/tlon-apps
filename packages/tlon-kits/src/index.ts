export {
  bindingLoadSchema,
  kitBindingSchema,
  kitManifestSchema,
  kitPlaceSchema,
  kitPolicySchema,
  kitScaffoldSchema,
  kitScheduleSchema,
  kitScopeSchema,
  placeKindSchema,
  toWireKit,
  toWireManifest,
  wireBindingSchema,
  wireKitSchema,
  wireManifestSchema,
  wirePlaceSchema,
} from './manifest.js';
export type {
  BindingLoad,
  KitBinding,
  KitManifest,
  KitPlace,
  KitPolicy,
  KitScaffold,
  KitSchedule,
  KitScope,
  PlaceKind,
  WireBinding,
  WireKit,
  WireManifest,
  WirePlace,
} from './manifest.js';

// The loader reads kits off disk and is deliberately NOT re-exported here:
// this barrel is imported by @tloncorp/api, which runs in the browser, and
// pulling in node:fs makes the web bundle throw at module-eval time. Node
// callers import it from '@tloncorp/tlon-kits/loader'.

export {
  KITS_BLOB_VERSION,
  WORKSPACE_CAPABILITIES,
  parseGroupKitConfig,
} from './groupConfig.js';
export type {
  GroupKitConfig,
  GroupKitEntry,
  GroupKitSchedule,
  ParseGroupKitConfigOptions,
  WorkspaceCapability,
} from './groupConfig.js';
