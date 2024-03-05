import { expect, test } from 'vitest';

import { formatPhoneNumber, transformShipURL } from './string';

test('formats phone number without country code', () => {
  expect(formatPhoneNumber('5555555555')).toBe('(555) 555-5555');
  expect(formatPhoneNumber('555-555-5555')).toBe('(555) 555-5555');
});

test('formats phone number with country code', () => {
  expect(formatPhoneNumber('15555555555')).toBe('+1 (555) 555-5555');
  expect(formatPhoneNumber('+15555555555')).toBe('+1 (555) 555-5555');
});

test('skips when given unknown format', () => {
  expect(formatPhoneNumber('1234')).toBe('1234');
});

test('transforms ship url without a protocol', () => {
  expect(transformShipURL('sampel-palnet.tlon.network')).toBe(
    'https://sampel-palnet.tlon.network'
  );
});

test('transforms ship url with a path', () => {
  expect(transformShipURL('sampel-palnet.tlon.network/apps/groups')).toBe(
    'https://sampel-palnet.tlon.network'
  );
});

test('transforms ship url with a protocol and extra whitespace', () => {
  expect(transformShipURL('https://sampel-palnet.tlon.network ')).toBe(
    'https://sampel-palnet.tlon.network'
  );
});

test('transforms ship url with trailing slash', () => {
  expect(transformShipURL('https://sampel-palnet.tlon.network/')).toBe(
    'https://sampel-palnet.tlon.network'
  );
});

test('if a ship url is already valid, it is returned as is', () => {
  expect(transformShipURL('https://sampel-palnet.tlon.network')).toBe(
    'https://sampel-palnet.tlon.network'
  );
});

test('if a ship url is an ip address with a port, it is returned as is', () => {
  expect(transformShipURL('http://192.168.0.1:8443')).toBe(
    'http://192.168.0.1:8443'
  );
});

test('if a ship url is an ip address without a port, it is returned as is', () => {
  expect(transformShipURL('http://192.168.0.1')).toBe('http://192.168.0.1');
});

test('if a ship url is http://localhost, it is returned as is', () => {
  expect(transformShipURL('http://localhost')).toBe('http://localhost');
});
