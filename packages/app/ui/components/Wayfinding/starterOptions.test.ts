import { describe, expect, it } from 'vitest';

import {
  STARTER_OPTIONS,
  buildStarterOptions,
  defaultStarterOptionId,
  isStarterOptionId,
} from './starterOptions';

describe('starter options', () => {
  it('offers the three shared-domestic starters', () => {
    expect(buildStarterOptions().map((option) => option.id)).toEqual([
      'meal-plan',
      'household-tasks',
      'garden-plan',
    ]);
  });

  // The spike put meals first and recommended it because it is the only one
  // whose core loop needs nothing that does not exist yet.
  it('recommends meal planning, and only meal planning', () => {
    const recommended = STARTER_OPTIONS.filter(
      (option) => option.recommendationLabel
    );
    expect(recommended).toHaveLength(1);
    expect(recommended[0].id).toBe('meal-plan');
    expect(recommended[0].recommendationLabel).toBe('Recommended');
  });

  it('gives every option a label and a description', () => {
    for (const option of STARTER_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(0);
    }
  });

  it('keeps ids unique, since they are recorded as kit ids', () => {
    const ids = STARTER_OPTIONS.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defaults to the recommended option', () => {
    expect(defaultStarterOptionId()).toBe('meal-plan');
  });

  it('recognizes only known ids', () => {
    expect(isStarterOptionId('garden-plan')).toBe(true);
    expect(isStarterOptionId('book-club')).toBe(false);
    expect(isStarterOptionId(undefined)).toBe(false);
  });
});
