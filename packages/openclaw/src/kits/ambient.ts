/**
 * Pure assembly helpers for kit prompt material: the ambient system-context
 * block injected on every group turn, the places legend, and the trigger
 * lookups shared by schedules (trigger `schedule.<id>`) and setup
 * (trigger `install.setup`).
 */
import type { Kit, KitBinding } from '@tloncorp/api';

import type { InstalledKitConfig } from './group-config.js';

export const SETUP_TRIGGER = 'install.setup';

/** `picks → chat/~host/picks, discussion → chat/~host/discussion` */
export function formatPlacesLegend(places: Record<string, string>): string {
  const parts = Object.entries(places).map(([name, nest]) => {
    return `${name} → ${nest}`;
  });
  return parts.join(', ');
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
  const legend = formatPlacesLegend(entry.places);
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
