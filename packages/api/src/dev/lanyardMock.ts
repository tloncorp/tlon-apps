// Dev-only escape hatch for testing the lanyard contact-discovery
// flow without a real lanyard backend or a phone attestation. When
// MOCK_LANYARD_DISCOVERY is set to a positive integer N, lanyard
// discovery returns N synthetic matches against the first N phone
// numbers in the submitted set, rotating through MOCK_DISCOVERY_SHIPS.
//
// Computer-class ships so accounts that already have galaxies as
// contacts (common on Tlon staging) don't filter the matches out as
// "already a contact".
//
// Imported from production modules at exactly two surfaces:
//   - lanyardApi.discoverContacts: returns the synthetic match set
//     instead of calling lanyard.
//   - sync.syncContactDiscovery: bypasses the phone-attestation gate
//     and the already-known filter so repeated test runs keep
//     surfacing matches.
import { createDevLogger } from '../lib/logger';

const logger = createDevLogger('lanyardMock', false);

const MOCK_DISCOVERY_SHIPS = [
  '~ravmel-ropdyl',
  '~palfun-foslup',
  '~bisbex-radmev',
  '~watter-parner',
  '~rilfun-lidlen',
  '~salfun-saplen',
  '~mibbel-foslup',
  '~lillex-foslup',
  '~dalfun-saplen',
  '~lilfun-saplen',
];

const MOCK_LATENCY_MS = 8000;

export function isLanyardMockEnabled(): boolean {
  if (typeof process === 'undefined') return false;
  return !!process.env?.MOCK_LANYARD_DISCOVERY;
}

export async function runLanyardMockDiscovery(
  phoneNums: string[]
): Promise<{ matches: [string, string][]; nextSalt: string | null }> {
  const count = Math.min(
    parseInt(process.env.MOCK_LANYARD_DISCOVERY || '3', 10),
    10
  );
  const matches: [string, string][] = phoneNums
    .slice(0, count)
    .map((phone, i) => [
      phone,
      MOCK_DISCOVERY_SHIPS[i % MOCK_DISCOVERY_SHIPS.length],
    ]);
  // Simulate network + verifier latency so callers can exercise the
  // "still discovering" UI state.
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
  logger.log('mocked discoverContacts', { matches });
  return { matches, nextSalt: '0x0' };
}
