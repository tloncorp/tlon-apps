export type ProductionAssetIssue = { kind: 'incomplete'; message: string };
export function assetHash(value: string | Uint8Array): string;
export function snapshotWebSources(
  root: string,
  options?: { version?: number }
): {
  root: string;
  head: string;
  files: unknown[];
  digest: string;
  identity?: {
    policy: string;
    runtimeDigest: string;
    testDigest: string;
    testFiles: unknown[];
  };
};
export function assessBuildReceipt(receipt: unknown): string[];
export function verifyCurrentWebBuild(
  receipt: unknown,
  root: string
): {
  checkedAt: number;
  sourceDigest: string;
  outputDigest: string;
  version?: number;
  root?: string;
  head?: string;
  identity?: {
    policy: string;
    runtimeDigest: string;
    testDigest: string;
    testFiles: unknown[];
  };
};
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

export function sourceIdentities(
  files: Array<{ path: string; [key: string]: unknown }>
): {
  policy: string;
  runtimeDigest: string;
  testDigest: string;
  testFiles: unknown[];
};
export function createWebTestIsolationPlugin(
  root: string,
  scope: 'main' | 'worker'
): import('vite').Plugin;
