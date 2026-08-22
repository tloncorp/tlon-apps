/**
 * Pure assembly helpers for kit prompt material: the ambient system-context
 * block injected on every group turn, the places legend, and the trigger
 * lookups shared by schedules (trigger `schedule.<id>`) and setup
 * (trigger `install.setup`).
 */
import type { Kit, KitBinding, KitPlace } from '@tloncorp/api';

import type { GroupChannelTitles, InstalledKitConfig } from './group-config.js';

export const SETUP_TRIGGER = 'install.setup';

/** Legend value for a place whose channel cannot be resolved (yet). */
export const PENDING_PLACE = '(pending)';

/** `picks → chat/~host/picks, discussion → chat/~host/discussion` */
export function formatPlacesLegend(places: Record<string, string>): string {
  const parts = Object.entries(places).map(([name, nest]) => {
    return `${name} → ${nest}`;
  });
  return parts.join(', ');
}

/**
 * Resolve every manifest place to a concrete nest. Chat/gallery places come
 * straight from the install config's places map. Notebook places are created
 * via %notes at install time — %notes slugifies the flag and self-registers
 * the channel with the group, so they are absent from the config — and are
 * resolved from the group's channels by kind prefix (`notes/`) plus a title
 * match against the manifest place title (falling back to the sole notes
 * channel), else rendered as "(pending)".
 */
export function resolveKitPlaces(params: {
  manifestPlaces: KitPlace[];
  configPlaces: Record<string, string>;
  groupChannels?: GroupChannelTitles | null;
}): Record<string, string> {
  const { manifestPlaces, configPlaces, groupChannels } = params;
  const notesChannels = Object.entries(groupChannels ?? {}).filter(([nest]) =>
    nest.startsWith('notes/')
  );
  const resolved: Record<string, string> = {};
  for (const place of manifestPlaces) {
    const configured = configPlaces[place.name];
    if (typeof configured === 'string' && configured.trim()) {
      resolved[place.name] = configured;
      continue;
    }
    if (place.kind === 'notebook') {
      const byTitle = notesChannels.filter(
        ([, title]) => title === place.title
      );
      const match =
        byTitle.length === 1
          ? byTitle[0]
          : notesChannels.length === 1
            ? notesChannels[0]
            : null;
      resolved[place.name] = match ? match[0] : PENDING_PLACE;
      continue;
    }
    resolved[place.name] = PENDING_PLACE;
  }
  // Config places the manifest doesn't name still render (defensive).
  for (const [name, nest] of Object.entries(configPlaces)) {
    if (!(name in resolved)) {
      resolved[name] = nest;
    }
  }
  return resolved;
}

/**
 * The kit's primary place: the place named "discussion" when present,
 * otherwise the first chat place. Replies to scheduled prompts and the setup
 * conversation land here.
 */
export function resolvePrimaryPlaceNest(
  places: Record<string, string>
): string | null {
  const discussion = places['discussion'];
  if (typeof discussion === 'string' && discussion.trim()) {
    return discussion;
  }
  for (const nest of Object.values(places)) {
    if (typeof nest === 'string' && nest.startsWith('chat/')) {
      return nest;
    }
  }
  return null;
}

function bindingContent(kit: Kit, binding: KitBinding): string | null {
  const content = kit.files[binding.file];
  return typeof content === 'string' && content.trim() ? content : null;
}

/**
 * Content of the on-trigger instruction file bound to `trigger`, or null when
 * the kit has no such binding (or the file is missing from the package).
 */
export function findTriggerBindingContent(
  kit: Kit,
  trigger: string
): string | null {
  for (const binding of kit.manifest.bindings) {
    if (binding.load === 'on-trigger' && binding.trigger === trigger) {
      return bindingContent(kit, binding);
    }
  }
  return null;
}

/**
 * Assemble the ambient system-context block for one installed kit: every
 * `load: "ambient"` instruction whose scope is `group`, full text, under a
 * header naming the kit plus a places legend mapping abstract place names to
 * concrete channels. Instructions with `load: "on-trigger"` or `"pulled"` are
 * never included here.
 */
export function buildKitAmbientContext(params: {
  groupFlag: string;
  entry: InstalledKitConfig;
  kit: Kit;
  groupChannels?: GroupChannelTitles | null;
}): string | null {
  const { groupFlag, entry, kit } = params;
  const sections: string[] = [];
  for (const binding of kit.manifest.bindings) {
    if (binding.load !== 'ambient' || binding.scope !== 'group') {
      continue;
    }
    const content = bindingContent(kit, binding);
    if (!content) {
      continue;
    }
    sections.push(`--- ${binding.file} ---\n${content.trim()}`);
  }
  if (sections.length === 0) {
    return null;
  }
  const legend = formatPlacesLegend(
    resolveKitPlaces({
      manifestPlaces: kit.manifest.places,
      configPlaces: entry.places,
      groupChannels: params.groupChannels,
    })
  );
  const header =
    `[Kit: ${kit.manifest.name} (${kit.manifest.id} v${kit.manifest.version}) ` +
    `installed in group ${groupFlag}]` +
    (legend ? `\nPlaces: ${legend}` : '');
  return `${header}\n\n${sections.join('\n\n')}`;
}

/** One line of context prefixed to scheduled-trigger and setup prompts. */
export function formatKitContextLine(params: {
  label: string;
  kitId: string;
  groupFlag: string;
  places: Record<string, string>;
}): string {
  const legend = formatPlacesLegend(params.places);
  return (
    `[${params.label}: kit ${params.kitId} in group ${params.groupFlag}` +
    (legend ? ` | places: ${legend}` : '') +
    ']'
  );
}
