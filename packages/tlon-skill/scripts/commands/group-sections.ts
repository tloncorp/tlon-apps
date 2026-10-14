// Channel sections and channel order in a group, as raw `group-action-5`
// pokes. Each poke is read back before the next is sent: a poke ack only means
// the bot's ship forwarded the command, and the host's nack never reaches us.
import { errorMessage } from './command';
import type { RawGroupForAdminVerification as RawGroup } from './groups-verification';

const DEFAULT_SECTION_ID = 'default';

export interface GroupSectionsDeps {
  assertCanAdminister: (groupId: string, action: string) => Promise<void>;
  getRawGroup: (groupId: string) => Promise<RawGroup>;
  verify: (
    groupId: string,
    isSatisfied: (rawGroup: RawGroup) => boolean,
    describeFailure: (lastSnapshot: RawGroup | undefined) => string
  ) => Promise<RawGroup>;
  pokeGroupAction: (json: unknown) => Promise<void>;
  createSectionId: () => string;
  formatUd: (value: number) => string;
  log: (line: string) => void;
}

// Any failure after a poke was handed to the client. A rejected poke may still
// have been forwarded (reap, ack timeout), so it is never "not applied".
class UnverifiedStageError extends Error {}

async function sendAndVerify(
  deps: GroupSectionsDeps,
  groupId: string,
  json: unknown,
  isSatisfied: (rawGroup: RawGroup) => boolean,
  describeFailure: (lastSnapshot: RawGroup | undefined) => string
): Promise<RawGroup> {
  try {
    await deps.pokeGroupAction(json);
  } catch (error) {
    throw new UnverifiedStageError(
      `the poke was rejected: ${errorMessage(error)}`
    );
  }
  try {
    return await deps.verify(groupId, isSatisfied, describeFailure);
  } catch (error) {
    throw new UnverifiedStageError(errorMessage(error));
  }
}

function groupAction(groupId: string, aGroup: unknown) {
  return { group: { flag: groupId, 'a-group': aGroup } };
}

function sectionActionJson(
  groupId: string,
  sectionId: string,
  aSection: unknown
) {
  return groupAction(groupId, {
    section: { 'section-id': sectionId, 'a-section': aSection },
  });
}

function channelSectionJson(groupId: string, nest: string, sectionId: string) {
  return groupAction(groupId, {
    channel: { nest, 'a-channel': { section: sectionId } },
  });
}

// An empty `sections` map makes the bot's ship send the host only
// `%section-order`; a non-empty one would also send `%set`, which clients
// don't sync live.
function sectionOrderJson(groupId: string, order: string[]) {
  return groupAction(groupId, { navigation: { sections: {}, order } });
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function isBlankTitle(title: string): boolean {
  return title.trim().length === 0;
}

function assertTitle(title: string): string {
  if (isBlankTitle(title)) {
    throw new Error('Section title cannot be blank.');
  }
  return title.trim();
}

function sections(group: RawGroup) {
  return group.sections ?? {};
}

function sectionOrder(group: RawGroup): string[] {
  return group['section-order'] ?? [];
}

function channelOrder(group: RawGroup, sectionId: string): string[] {
  return sections(group)[sectionId]?.order ?? [];
}

function sectionTitle(group: RawGroup, sectionId: string): string {
  return sections(group)[sectionId]?.meta?.title || sectionId;
}

function describeSection(group: RawGroup, sectionId: string): string {
  return `${sectionTitle(group, sectionId)} (${sectionId})`;
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

// An exact id wins; otherwise every case-insensitive trimmed title match.
function matchSectionIds(group: RawGroup, input: string): string[] {
  const all = sections(group);
  if (Object.hasOwn(all, input)) return [input];
  const needle = normalizeTitle(input);
  return Object.keys(all).filter(
    (id) => normalizeTitle(all[id].meta?.title ?? '') === needle
  );
}

function resolveSectionId(
  group: RawGroup,
  groupId: string,
  input: string
): string {
  const matches = matchSectionIds(group, input);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(
      `Section "${input}" matches more than one section in ${groupId}: ${matches.join(', ')}. Use the section id.`
    );
  }
  throw new Error(`Section "${input}" not found in ${groupId}.`);
}

function findTitleConflict(
  group: RawGroup,
  title: string,
  exceptId?: string
): string | undefined {
  const needle = normalizeTitle(title);
  return Object.keys(sections(group)).find(
    (id) =>
      id !== exceptId &&
      normalizeTitle(sections(group)[id].meta?.title ?? '') === needle
  );
}

function refuseTitleConflict(
  group: RawGroup,
  groupId: string,
  title: string,
  exceptId?: string
): void {
  const conflict = findTitleConflict(group, title, exceptId);
  if (conflict) {
    throw new Error(
      `A section titled "${sectionTitle(group, conflict)}" already exists in ${groupId} (${conflict}).`
    );
  }
}

function orderSectionsCommand(groupId: string, order: string[]): string {
  return `tlon groups order-sections ${groupId} ${order.join(' ')}`;
}

function moveChannelCommand(
  groupId: string,
  nest: string,
  sectionId: string,
  index: number
): string {
  return `tlon groups move-channel ${groupId} ${nest} --section ${sectionId} --index ${index}`;
}

function renameSectionCommand(
  groupId: string,
  sectionId: string,
  title: string
): string {
  return `tlon groups rename-section ${groupId} ${sectionId} '${title.replaceAll("'", "'\\''")}'`;
}

function deleteSectionCommand(groupId: string, sectionId: string): string {
  return `tlon groups delete-section ${groupId} ${sectionId}`;
}

export async function addSection(
  groupId: string,
  rawTitle: string,
  deps: GroupSectionsDeps
): Promise<void> {
  const title = assertTitle(rawTitle);
  await deps.assertCanAdminister(groupId, 'add sections');
  const group = await deps.getRawGroup(groupId);
  refuseTitleConflict(group, groupId, title);

  // The follow-up reorder carries the current order. A section already missing
  // from it would stay hidden, and the order-sections repair printed on failure
  // would be refused for omitting it, so restore those first.
  const listed = sectionOrder(group).filter((id) =>
    Object.hasOwn(sections(group), id)
  );
  const hidden = Object.keys(sections(group)).filter(
    (id) => !listed.includes(id)
  );
  if (hidden.length > 0) {
    throw new Error(
      `${groupId} has sections missing from its section order, which the app does not show: ${hidden
        .map((id) => describeSection(group, id))
        .join(', ')}. Nothing was changed.\n` +
        `To restore them to the backend section order, run: ${orderSectionsCommand(groupId, [...listed, ...hidden])}\n` +
        `The app may need a full resync to show the previously hidden sections.\n` +
        `Then run add-section again.`
    );
  }

  // `%add` overwrites an existing id with an empty section, and these ids
  // repeat every ~9.3 h, so a collision must be refused, not sent.
  const sectionId = deps.createSectionId();
  if (Object.hasOwn(sections(group), sectionId)) {
    throw new Error(
      `Generated section id ${sectionId} already exists in ${groupId}; nothing was changed. Run the command again.`
    );
  }

  const expectedOrder = [...listed, sectionId];
  let added: RawGroup;
  try {
    added = await sendAndVerify(
      deps,
      groupId,
      sectionActionJson(groupId, sectionId, {
        add: { title, description: '', image: '', cover: '' },
      }),
      (g) => sections(g)[sectionId]?.meta?.title === title,
      () => `Section ${title} (${sectionId}) did not appear in ${groupId}.`
    );
  } catch (error) {
    if (!(error instanceof UnverifiedStageError)) throw error;
    throw new Error(
      `Adding section ${title} (${sectionId}) to ${groupId} was sent but not confirmed: ${error.message}\n` +
        `Do not re-run add-section. Check tlon groups info ${groupId}; if ${title} (${sectionId}) appears, run: ${orderSectionsCommand(groupId, expectedOrder)}`
    );
  }

  const order = [
    ...sectionOrder(added).filter((id) => id !== sectionId),
    sectionId,
  ];
  if (!sameList(sectionOrder(added), order)) {
    try {
      await sendAndVerify(
        deps,
        groupId,
        sectionOrderJson(groupId, order),
        (g) => sameList(sectionOrder(g), order),
        (last) =>
          `Section order of ${groupId} is [${sectionOrder(last ?? {}).join(', ')}], expected [${order.join(', ')}].`
      );
    } catch (error) {
      if (!(error instanceof UnverifiedStageError)) throw error;
      throw new Error(
        `Section ${title} (${sectionId}) was added (confirmed), but moving it to the bottom was sent and not confirmed: ${error.message}\n` +
          `To move it to the bottom, run: ${orderSectionsCommand(groupId, order)}`
      );
    }
  }

  deps.log(`✓ Section added at the bottom: ${title} (${sectionId})`);
}

export async function renameSection(
  groupId: string,
  sectionInput: string,
  rawTitle: string,
  deps: GroupSectionsDeps
): Promise<void> {
  const title = assertTitle(rawTitle);
  await deps.assertCanAdminister(groupId, 'rename sections');
  const group = await deps.getRawGroup(groupId);
  const sectionId = resolveSectionId(group, groupId, sectionInput);
  refuseTitleConflict(group, groupId, title, sectionId);

  const meta = sections(group)[sectionId].meta ?? {};
  if (meta.title === title) {
    deps.log(`Section ${sectionId} is already titled "${title}"`);
    return;
  }

  // Carry the raw description/image/cover: the client meta round trip loses
  // an icon color.
  const next = {
    title,
    description: meta.description ?? '',
    image: meta.image ?? '',
    cover: meta.cover ?? '',
  };
  try {
    await sendAndVerify(
      deps,
      groupId,
      sectionActionJson(groupId, sectionId, { edit: next }),
      (g) => {
        const actual = sections(g)[sectionId]?.meta;
        return (
          actual?.title === next.title &&
          (actual.description ?? '') === next.description &&
          (actual.image ?? '') === next.image &&
          (actual.cover ?? '') === next.cover
        );
      },
      () => `Section ${sectionId} in ${groupId} was not renamed to "${title}".`
    );
  } catch (error) {
    if (!(error instanceof UnverifiedStageError)) throw error;
    throw new Error(
      `Renaming section ${sectionId} was sent but not confirmed: ${error.message}\n` +
        `Check tlon groups info ${groupId}; if section ${sectionId} is not titled "${title}", run: ${renameSectionCommand(groupId, sectionId, title)}`
    );
  }

  deps.log(
    `✓ Section renamed: ${meta.title || sectionId} → ${title} (${sectionId})`
  );
}

function sectionAgreementProblems(
  group: RawGroup,
  groupId: string,
  sectionId: string
): string | null {
  const channels = group.channels ?? {};
  const listed = channelOrder(group, sectionId);
  const assigned = Object.keys(channels).filter(
    (nest) => channels[nest].section === sectionId
  );
  const repairable: string[] = [];
  const lines: string[] = [];
  for (const nest of assigned) {
    if (!listed.includes(nest)) {
      lines.push(`  ${nest}: assigned to this section but not listed in it`);
      repairable.push(nest);
    }
  }
  const unrepairable: string[] = [];
  for (const nest of listed) {
    if (!Object.hasOwn(channels, nest)) {
      lines.push(`  ${nest}: listed but not a channel`);
      unrepairable.push(nest);
    } else if (channels[nest].section !== sectionId) {
      lines.push(
        `  ${nest}: listed here but assigned to ${channels[nest].section}`
      );
      repairable.push(nest);
    }
  }
  if (lines.length === 0) return null;

  const out = [
    `Can't delete section ${describeSection(group, sectionId)} in ${groupId}: its channel listing disagrees with channel assignments. Nothing was changed.`,
    ...lines,
  ];
  if (repairable.length > 0) {
    out.push(
      'To repair the listing and delete the section, run in this order:',
      ...repairable.map(
        (nest) =>
          `  tlon groups move-channel ${groupId} ${nest} --section ${sectionId}`
      ),
      `  ${deleteSectionCommand(groupId, sectionId)}`
    );
  }
  if (unrepairable.length > 0) {
    out.push(
      `The CLI can't repair ${unrepairable.join(', ')}: they are not channels of ${groupId}.`
    );
  }
  return out.join('\n');
}

export async function deleteSection(
  groupId: string,
  sectionInput: string,
  deps: GroupSectionsDeps
): Promise<void> {
  await deps.assertCanAdminister(groupId, 'delete sections');
  const group = await deps.getRawGroup(groupId);
  const sectionId = resolveSectionId(group, groupId, sectionInput);
  if (sectionId === DEFAULT_SECTION_ID) {
    throw new Error(`The default section of ${groupId} can't be deleted.`);
  }
  const title = sectionTitle(group, sectionId);

  // `%del` relabels every channel assigned to the section but adds none of
  // them to default's order, so listing and assignment must agree first.
  const problems = sectionAgreementProblems(group, groupId, sectionId);
  if (problems) throw new Error(problems);

  // Moving in reverse keeps their relative order, since each move pushes the
  // channel to the front of default.
  const channels = channelOrder(group, sectionId);
  const moved: string[] = [];
  let latest = group;
  for (const nest of [...channels].reverse()) {
    try {
      latest = await sendAndVerify(
        deps,
        groupId,
        channelSectionJson(groupId, nest, DEFAULT_SECTION_ID),
        (g) =>
          g.channels?.[nest]?.section === DEFAULT_SECTION_ID &&
          channelOrder(g, DEFAULT_SECTION_ID).includes(nest) &&
          !channelOrder(g, sectionId).includes(nest),
        () => `${nest} did not move to the default section.`
      );
    } catch (error) {
      if (!(error instanceof UnverifiedStageError)) throw error;
      const notAttempted = [...channels]
        .reverse()
        .slice(moved.length + 1)
        .reverse();
      throw new Error(
        [
          `Deleting section ${title} (${sectionId}) in ${groupId} stopped while moving its channels to the default section. The section was not deleted.`,
          `  Moved to default (confirmed): ${moved.join(', ') || '(none)'}`,
          `  ${nest}: applied but unverified: ${error.message}`,
          `  Not attempted: ${notAttempted.join(', ') || '(none)'}`,
          `To finish, re-run: ${deleteSectionCommand(groupId, sectionId)}`,
        ].join('\n')
      );
    }
    moved.push(nest);
  }

  const defaultOrder = channelOrder(latest, DEFAULT_SECTION_ID);
  if (!sameList(defaultOrder.slice(0, channels.length), channels)) {
    throw new Error(
      [
        `All ${channels.length} channels moved to the default section, but its order there is [${defaultOrder.join(', ')}], not [${channels.join(', ')}, ...]. The section was not deleted.`,
        'To restore their order and delete the section, run in this order:',
        ...channels.map(
          (nest, i) =>
            `  ${moveChannelCommand(groupId, nest, DEFAULT_SECTION_ID, i)}`
        ),
        `  ${deleteSectionCommand(groupId, sectionId)}`,
        `To delete the section and keep the current order instead, run only: ${deleteSectionCommand(groupId, sectionId)}`,
      ].join('\n')
    );
  }

  // Races are only detectable between steps: re-read right before deleting so
  // a channel that entered the section meanwhile is not relabeled into no
  // section's order.
  let beforeDelete: RawGroup;
  try {
    beforeDelete = await deps.getRawGroup(groupId);
  } catch (error) {
    throw new Error(
      [
        `Deleting section ${title} (${sectionId}) in ${groupId} stopped: reading the group before the delete failed: ${errorMessage(error)}`,
        `  Moved to default (confirmed): ${moved.join(', ') || '(none)'}`,
        '  The deletion was NOT attempted.',
        `To finish, re-run: ${deleteSectionCommand(groupId, sectionId)}`,
      ].join('\n')
    );
  }
  const newcomers = [
    ...new Set([
      ...channelOrder(beforeDelete, sectionId),
      ...Object.keys(beforeDelete.channels ?? {}).filter(
        (nest) => beforeDelete.channels?.[nest].section === sectionId
      ),
    ]),
  ];
  if (newcomers.length > 0) {
    throw new Error(
      `New channels entered ${title} during the delete: ${newcomers.join(', ')}. ` +
        `Their moves to default are confirmed for ${moved.join(', ') || '(none)'}. ` +
        `The section was not deleted. To finish, re-run: ${deleteSectionCommand(groupId, sectionId)}`
    );
  }

  try {
    await sendAndVerify(
      deps,
      groupId,
      sectionActionJson(groupId, sectionId, { del: null }),
      (g) =>
        !Object.hasOwn(sections(g), sectionId) &&
        !sectionOrder(g).includes(sectionId),
      () => `Section ${sectionId} is still in ${groupId}.`
    );
  } catch (error) {
    if (!(error instanceof UnverifiedStageError)) throw error;
    const movedNote =
      channels.length > 0 ? 'All channels moved (confirmed). ' : '';
    throw new Error(
      `${movedNote}The delete of section ${title} (${sectionId}) was sent but not confirmed: ${error.message}\n` +
        `Re-run it ("not found" then means it is done): ${deleteSectionCommand(groupId, sectionId)}`
    );
  }

  deps.log(`✓ Section deleted: ${title} (${sectionId})`);
  if (channels.length > 0) {
    deps.log(
      `Its channels were moved to the top of the default section: ${channels.join(', ')}`
    );
  }
}

export async function moveChannel(
  groupId: string,
  nest: string,
  sectionInput: string,
  index: number | undefined,
  deps: GroupSectionsDeps
): Promise<void> {
  await deps.assertCanAdminister(groupId, 'move channels');
  const group = await deps.getRawGroup(groupId);
  const sectionId = resolveSectionId(group, groupId, sectionInput);
  const channel = group.channels?.[nest];
  if (!channel) {
    throw new Error(`Channel ${nest} is not in ${groupId}.`);
  }
  const title = sectionTitle(group, sectionId);

  // Both the listing and the assignment must name the target; otherwise the
  // `%section` poke is what repairs the split.
  const order = channelOrder(group, sectionId);
  const inPlace = order.includes(nest) && channel.section === sectionId;
  const lastIndex = order.filter((n) => n !== nest).length;
  const current = inPlace ? order.indexOf(nest) : undefined;
  const target = index ?? current ?? lastIndex;
  if (target > lastIndex) {
    throw new Error(
      `Index ${target} is out of range for ${title}: valid positions after the move are 0..${lastIndex}.`
    );
  }
  if (target === current) {
    deps.log(`${nest} is already in ${title} at position ${current}`);
    return;
  }

  const recovery = moveChannelCommand(groupId, nest, sectionId, target);
  let latest = group;
  if (!inPlace) {
    try {
      latest = await sendAndVerify(
        deps,
        groupId,
        channelSectionJson(groupId, nest, sectionId),
        (g) =>
          g.channels?.[nest]?.section === sectionId &&
          channelOrder(g, sectionId).includes(nest),
        () => `${nest} did not move to ${sectionId}.`
      );
    } catch (error) {
      if (!(error instanceof UnverifiedStageError)) throw error;
      throw new Error(
        `Moving ${nest} to ${title} (${sectionId}) was sent but not confirmed: ${error.message}\n` +
          `Run: ${recovery}`
      );
    }
  }

  if (channelOrder(latest, sectionId).indexOf(nest) !== target) {
    try {
      await sendAndVerify(
        deps,
        groupId,
        sectionActionJson(groupId, sectionId, {
          'move-nest': { nest, idx: deps.formatUd(target) },
        }),
        (g) => channelOrder(g, sectionId).indexOf(nest) === target,
        (last) =>
          `${nest} is at position ${channelOrder(last ?? {}, sectionId).indexOf(nest)} in ${sectionId}, expected ${target}.`
      );
    } catch (error) {
      if (!(error instanceof UnverifiedStageError)) throw error;
      const prefix = inPlace
        ? `Moving ${nest} to position ${target} in ${title} (${sectionId})`
        : `${nest} was moved to ${title} (${sectionId}) (confirmed), but positioning it at ${target}`;
      throw new Error(
        `${prefix} was sent but not confirmed: ${error.message}\n` +
          `Run: ${recovery}`
      );
    }
  }

  deps.log(`✓ Moved ${nest} to ${title} (${sectionId}) at position ${target}`);
}

export async function orderSections(
  groupId: string,
  sectionInputs: string[],
  deps: GroupSectionsDeps
): Promise<void> {
  await deps.assertCanAdminister(groupId, 'order sections');
  const group = await deps.getRawGroup(groupId);

  const order: string[] = [];
  const unknown: string[] = [];
  for (const input of sectionInputs) {
    if (matchSectionIds(group, input).length === 0) {
      unknown.push(input);
    } else {
      order.push(resolveSectionId(group, groupId, input));
    }
  }
  // The universe is every section, including ones already missing from the
  // order: `%section-order` replaces the order, and an omitted section
  // disappears from the app.
  const universe = Object.keys(sections(group));
  const missing = universe.filter((id) => !order.includes(id));
  const duplicated = [
    ...new Set(order.filter((id, i) => order.indexOf(id) !== i)),
  ];
  if (missing.length + duplicated.length + unknown.length > 0) {
    const lines = [
      `order-sections must list every section of ${groupId} exactly once. Nothing was changed.`,
    ];
    if (missing.length > 0) {
      lines.push(
        `  Missing: ${missing.map((id) => describeSection(group, id)).join(', ')}`
      );
    }
    if (duplicated.length > 0) {
      lines.push(
        `  Duplicated: ${duplicated.map((id) => describeSection(group, id)).join(', ')}`
      );
    }
    if (unknown.length > 0) {
      lines.push(`  Unknown: ${unknown.map((s) => `"${s}"`).join(', ')}`);
    }
    throw new Error(lines.join('\n'));
  }

  if (sameList(sectionOrder(group), order)) {
    deps.log(`Sections in ${groupId} are already in that order.`);
    return;
  }

  try {
    await sendAndVerify(
      deps,
      groupId,
      sectionOrderJson(groupId, order),
      (g) => sameList(sectionOrder(g), order),
      (last) =>
        `Section order of ${groupId} is [${sectionOrder(last ?? {}).join(', ')}], expected [${order.join(', ')}].`
    );
  } catch (error) {
    if (!(error instanceof UnverifiedStageError)) throw error;
    throw new Error(
      `Reordering sections was sent but not confirmed: ${error.message} Re-running the command is safe.`
    );
  }

  deps.log(
    `✓ Sections ordered: ${order.map((id) => describeSection(group, id)).join(', ')}`
  );
}
