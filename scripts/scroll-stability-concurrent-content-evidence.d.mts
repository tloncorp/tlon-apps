import type {
  ConcurrentContentProof,
  assessConcurrentContentEvidence,
} from '../packages/app/fixtures/scrollConcurrentContentTrace';
export function replayConcurrentContentProof(
  proof: ConcurrentContentProof,
  attempt?: {
    startTime: string;
    duration: number;
    wallEndTime?: number;
    clockError?: string;
  }
): ReturnType<typeof assessConcurrentContentEvidence>;
