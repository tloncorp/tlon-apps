export type ProductionAssetIssue = { kind: 'incomplete'; message: string };
export function assetHash(value: string | Uint8Array): string;
export function snapshotWebSources(root: string): {
  root: string;
  head: string;
  files: unknown[];
  digest: string;
};
export function assessBuildReceipt(receipt: unknown): string[];
export function verifyCurrentWebBuild(
  receipt: unknown,
  root: string
): { checkedAt: number; sourceDigest: string; outputDigest: string };
export function assessProductionAssets(
  proof: unknown,
  expected: {
    origin?: string;
    scope?: string;
    attemptStartTime: string;
    attemptDurationMs: number;
    attemptWallEndTime?: number;
    attemptClockError?: string;
    performanceEndTime?: number;
  }
): ProductionAssetIssue[];
export function buildWebReceipt(options: {
  root: string;
  output: string;
  receiptPath: string;
}): unknown;
