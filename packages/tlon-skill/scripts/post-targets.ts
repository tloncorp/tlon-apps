export function isOneToOneDmTarget(target: string): boolean {
  const trimmed = target.trim();
  return trimmed.startsWith('~') && !trimmed.includes('/');
}

export function defaultReplyParentAuthor(
  target: string,
  authorId: string,
  explicitParentAuthor?: string
): string {
  if (explicitParentAuthor) {
    return explicitParentAuthor;
  }
  return isOneToOneDmTarget(target) ? target.trim() : authorId;
}
