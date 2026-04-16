import { expect, test } from 'vitest';

import { formatUserId } from './user';

test('format galaxy', () => {
  const galaxy = '~zod';
  const formatted = formatUserId(galaxy);

  expect(formatted?.display).toBe('~zod');
  expect(formatted?.ariaLabel).toBe('zod');
});

test('format star', () => {
  const star = '~fabled';
  const formatted = formatUserId(star);

  expect(formatted?.display).toBe('~fabled');
  expect(formatted?.ariaLabel).toBe('fabled');
});

test('format planet', () => {
  const planet = '~latter-bolden';
  const formatted = formatUserId(planet);

  expect(formatted?.display).toBe('~latter-bolden');
  expect(formatted?.ariaLabel).toBe('latter - bolden');
});

test('format moon', () => {
  const moon = '~livnex-tarlup-pondus-watbel';
  const formatted = formatUserId(moon);

  expect(formatted?.display).toBe('~livnex-tarlup-pondus-watbel');
  expect(formatted?.ariaLabel).toBe('livnex - tarlup - pondus - watbel');
});

test('format moon (full)', () => {
  const moon = '~livnex-tarlup-pondus-watbel';
  const formatted = formatUserId(moon, true);

  expect(formatted?.display).toBe('~livnex-tarlup-pondus-watbel');
  expect(formatted?.ariaLabel).toBe('livnex - tarlup - pondus - watbel');
});

test('format star moon', () => {
  const starMoon = '~sampel-sampel-dozzod-bacwyd';
  const formatted = formatUserId(starMoon);

  expect(formatted?.display).toBe('~sampel-sampel-dozzod-bacwyd');
  expect(formatted?.ariaLabel).toBe(
    'sampel - sampel - dozzod - bacwyd'
  );
});

test('format galaxy moon', () => {
  const galaxyMoon = '~sampel-sampel-dozzod-dozzod';
  const formatted = formatUserId(galaxyMoon);

  expect(formatted?.display).toBe('~sampel-sampel-dozzod-dozzod');
  expect(formatted?.ariaLabel).toBe('sampel - sampel - dozzod - dozzod');
});

test('format comet', () => {
  const comet = '~siclec-ramsub-tichul-riptud--dibnet-datryg-fiddep-binzod';
  const formatted = formatUserId(comet);

  expect(formatted?.display).toBe('~siclec_binzod');
  expect(formatted?.ariaLabel).toBe('siclec _ binzod');
});

test('format comet (full)', () => {
  const comet = '~siclec-ramsub-tichul-riptud--dibnet-datryg-fiddep-binzod';
  const formatted = formatUserId(comet, true);

  expect(formatted?.display).toBe(
    '~siclec-ramsub-tichul-riptud--dibnet-datryg-fiddep-binzod'
  );
  expect(formatted?.ariaLabel).toBe(
    'siclec - ramsub - tichul - riptud -  - dibnet - datryg - fiddep - binzod'
  );
});
