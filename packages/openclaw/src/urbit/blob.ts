export function serializeContextLensReferenceBlob(
  lensId: string,
  botShip?: string
): string {
  return JSON.stringify([
    {
      type: 'tlon-context-lens',
      version: 1,
      lensId,
      ...(botShip ? { botShip } : {}),
    },
  ]);
}
