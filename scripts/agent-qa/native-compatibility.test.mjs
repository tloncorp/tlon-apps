import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeKey } from './native-compatibility.mjs';
const fingerprint = {
  sources: [
    {
      type: 'contents',
      id: 'expoConfig',
      hash: 'config',
      contents: JSON.stringify({
        ios: { bundleIdentifier: 'io.tlon.groups' },
        extra: { gitHash: 'oldsha', automatedTest: 'true' },
      }),
    },
    { type: 'dir', filePath: 'ios', hash: 'native-source' },
    { type: 'file', filePath: 'Podfile.lock', hash: 'pods' },
  ],
};
test('native reuse tolerates only the source label that repacking replaces', () => {
  const next = structuredClone(fingerprint);
  next.sources[0].contents = next.sources[0].contents.replace(
    'oldsha',
    'newsha'
  );
  next.sources[0].hash = 'new-config';
  assert.equal(nativeKey(next), nativeKey(fingerprint));
  for (const mutate of [
    (v) => (v.sources[1].hash = 'native-change'),
    (v) => (v.sources[2].hash = 'pod-change'),
    (v) =>
      (v.sources[0].contents = v.sources[0].contents.replace('true', 'false')),
  ]) {
    const changed = structuredClone(fingerprint);
    mutate(changed);
    assert.notEqual(nativeKey(changed), nativeKey(fingerprint));
  }
  const wrong = structuredClone(fingerprint);
  wrong.sources[0].contents = wrong.sources[0].contents.replace(
    'io.tlon.groups',
    'io.other'
  );
  assert.throws(() => nativeKey(wrong), /e2e profile/);
});
