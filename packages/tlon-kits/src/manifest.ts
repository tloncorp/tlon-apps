/**
 * Zod schemas for the two kit JSON shapes (see kits/SCHEMA.md at the repo
 * root and desk/sur/kits.hoon):
 *
 * 1. The on-disk authoring format (`kit.json`): places as a map of
 *    name -> {type, title, description}, semver in `kitVersion`, policy as a
 *    structured object.
 * 2. The wire format the %kits agent accepts/emits (kits-action-1 /
 *    kits-update-1 marks): places as a list of {name, kind, ...}, semver in
 *    `version`, policy as an opaque JSON string, and explicit nulls for
 *    absent optional fields (the Hoon mark uses `mu` and requires the keys).
 */
import { z } from 'zod';

/** Urbit @tas: kebab-case starting with a letter. */
const TERM_PATTERN = /^[a-z][a-z0-9-]*$/;

const termSchema = z
  .string()
  .regex(TERM_PATTERN, 'must be a kebab-case term (@tas)');

const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'must be a semver triple (e.g. "0.1.0")');

const shipSchema = z
  .string()
  .regex(/^~[a-z][a-z-]*$/, 'must be an Urbit ship name (@p)');

export const kitScopeSchema = z.enum(['group', 'dm', 'agent']);
export type KitScope = z.infer<typeof kitScopeSchema>;

/** On-disk place `type` and wire place `kind` share the same vocabulary. */
export const placeKindSchema = z.enum(['chat', 'notebook', 'gallery']);
export type PlaceKind = z.infer<typeof placeKindSchema>;

export const bindingLoadSchema = z.enum(['ambient', 'on-trigger', 'pulled']);
export type BindingLoad = z.infer<typeof bindingLoadSchema>;

//  On-disk kit.json (SCHEMA.md section 1)

export const kitPlaceSchema = z.object({
  type: placeKindSchema,
  title: z.string(),
  description: z.string(),
});
export type KitPlace = z.infer<typeof kitPlaceSchema>;

export const kitBindingSchema = z.object({
  file: z.string(),
  scope: kitScopeSchema,
  trigger: z.string().optional(),
  load: bindingLoadSchema,
});
export type KitBinding = z.infer<typeof kitBindingSchema>;

export const kitScheduleSchema = z.object({
  id: termSchema,
  cron: z.string(),
  description: z.string(),
});
export type KitSchedule = z.infer<typeof kitScheduleSchema>;

export const kitScaffoldSchema = z.object({
  file: z.string(),
  workspace: z.string(),
});
export type KitScaffold = z.infer<typeof kitScaffoldSchema>;

/** Labeled policy patches; entries are harness-interpreted, so kept opaque. */
export const kitPolicySchema = z.object({
  required: z.array(z.unknown()),
  recommended: z.array(z.unknown()),
});
export type KitPolicy = z.infer<typeof kitPolicySchema>;

export const kitManifestSchema = z.object({
  version: z.literal(1),
  id: termSchema,
  name: z.string(),
  kitVersion: semverSchema,
  publisher: shipSchema,
  description: z.string(),
  image: z.string().optional(),
  scope: kitScopeSchema,
  places: z.record(termSchema, kitPlaceSchema),
  bindings: z.array(kitBindingSchema),
  schedules: z.array(kitScheduleSchema),
  scaffolds: z.array(kitScaffoldSchema),
  policy: kitPolicySchema.optional(),
});
export type KitManifest = z.infer<typeof kitManifestSchema>;

//  Wire format (sur/kits.hoon + mar/kits/action-1.hoon)

export const wirePlaceSchema = z.object({
  name: termSchema,
  kind: placeKindSchema,
  title: z.string(),
  description: z.string(),
});
export type WirePlace = z.infer<typeof wirePlaceSchema>;

export const wireBindingSchema = z.object({
  file: z.string(),
  scope: kitScopeSchema,
  trigger: z.string().nullable(),
  load: bindingLoadSchema,
});
export type WireBinding = z.infer<typeof wireBindingSchema>;

export const wireManifestSchema = z.object({
  id: termSchema,
  name: z.string(),
  version: semverSchema,
  publisher: shipSchema,
  description: z.string(),
  image: z.string().nullable(),
  scope: kitScopeSchema,
  places: z.array(wirePlaceSchema),
  bindings: z.array(wireBindingSchema),
  schedules: z.array(kitScheduleSchema),
  scaffolds: z.array(kitScaffoldSchema),
  policy: z.string().nullable(),
});
export type WireManifest = z.infer<typeof wireManifestSchema>;

export const wireKitSchema = z.object({
  manifest: wireManifestSchema,
  files: z.record(z.string(), z.string()),
});
export type WireKit = z.infer<typeof wireKitSchema>;

//  Conversion

export function toWireManifest(manifest: KitManifest): WireManifest {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.kitVersion,
    publisher: manifest.publisher,
    description: manifest.description,
    image: manifest.image ?? null,
    scope: manifest.scope,
    // On-disk `type` values map 1:1 onto wire `kind` values.
    places: Object.entries(manifest.places).map(([name, place]) => ({
      name,
      kind: place.type,
      title: place.title,
      description: place.description,
    })),
    bindings: manifest.bindings.map((binding) => ({
      file: binding.file,
      scope: binding.scope,
      trigger: binding.trigger ?? null,
      load: binding.load,
    })),
    schedules: manifest.schedules.map((schedule) => ({ ...schedule })),
    scaffolds: manifest.scaffolds.map((scaffold) => ({ ...scaffold })),
    policy: manifest.policy == null ? null : JSON.stringify(manifest.policy),
  };
}

/**
 * Convert a dir-loaded kit into the wire kit for the %kits `add` poke:
 * `{"add": {"kit": toWireKit(kit)}}` with mark %kits-action-1.
 */
export function toWireKit(kit: {
  manifest: KitManifest;
  files: Record<string, string>;
}): WireKit {
  return {
    manifest: toWireManifest(kit.manifest),
    files: { ...kit.files },
  };
}
