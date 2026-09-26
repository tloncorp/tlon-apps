import { expect, test } from 'vitest';
import { ONBOARDING_JOB_NAME } from '../../src/monitor/onboarding-job.js';
import {
  createVariant,
  previewTips,
  readVariantFile,
  tipOverrides,
  writeVariantFile,
} from './workbench.js';

test('previews every tip without the internal job name', () => {
  const cases = previewTips('', { topic: 'Tides' });
  expect(cases.length).toBeGreaterThan(10);
  for (const item of cases)
    expect(item.text).not.toContain(ONBOARDING_JOB_NAME);
  expect(cases.find((item) => item.id === 'first-topic')?.text).toContain(
    'You mentioned Tides'
  );
});

test('applies tips.yaml overrides and fills placeholders', () => {
  const cases = previewTips('taskDelivered: "Is {task} still useful?"\n', {});
  expect(cases.find((item) => item.id === 'feedback-delivered')?.text).toBe(
    'Is your recurring update still useful?'
  );
});

test('rejects tip keys the product does not have', () => {
  expect(() => tipOverrides('taskDelivrd: typo\n')).toThrow('Unknown tip keys');
  expect(() => tipOverrides('- a list\n')).toThrow('must be a map');
});

test('refuses names and files outside the variant folder', () => {
  expect(() => createVariant('../escape', 'baseline')).toThrow();
  expect(() => createVariant('baseline', 'baseline')).toThrow();
  expect(() => readVariantFile('baseline', '../../.env')).toThrow(
    'Not an editable variant file'
  );
  expect(() => writeVariantFile('baseline', 'SKILL.md', 'x')).toThrow();
});
