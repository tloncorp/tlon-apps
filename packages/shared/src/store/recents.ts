import * as db from '../db';

export type VisitKind = 'app' | 'channel';
export type MentionKind = 'contact';

export async function recordVisit(args: {
  kind: VisitKind;
  id: string;
}): Promise<void> {
  if (!args.id) return;
  await db.setRecent({ scope: 'visit', kind: args.kind, targetId: args.id });
}

export async function recordMention(args: {
  kind: MentionKind;
  id: string;
}): Promise<void> {
  if (!args.id) return;
  await db.setRecent({ scope: 'mention', kind: args.kind, targetId: args.id });
}
