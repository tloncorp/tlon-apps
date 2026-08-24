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
// this barrel may be bundled for the browser by in-repo consumers, and
// pulling in node:fs makes the web bundle throw at module-eval time. Node
// callers import it from '@tloncorp/tlon-kits/loader'.

// The group-blob parser (parseGroupKitConfig and friends) lives in
// @tloncorp/api: both published readers — the client and the OpenClaw
// harness — need it at runtime, and this package is deliberately
// monorepo-only (never published), so it cannot host code they ship.
