// Trusted note appended to the owner's DM messages once first-run onboarding
// is over. The same rule lives in the bot's AGENTS.md, but there the model
// answered a trip or study plan inline; next to the message it creates the
// workspace.

export function ownerDmWorkspaceNote(ownerShip: string): string {
  return (
    '\n[Workspace rule: if this message starts a topic that will outlast this reply ' +
    '(a project, trip, course, renovation or routine), your first tool calls are ' +
    '`groups list`, then, unless a workspace already covers it, ' +
    `\`groups create-owned "<title>" --admin ${ownerShip}\` with a short, specific title ` +
    'from the conversation, never a generic one. Do not ask first. Open your reply ' +
    'with one line naming the workspace and its `Ref:` path bare on its own line, ' +
    'then answer. If you already linked it in this conversation, do not link it again. ' +
    'Small talk and one-off questions get no workspace.]'
  );
}
