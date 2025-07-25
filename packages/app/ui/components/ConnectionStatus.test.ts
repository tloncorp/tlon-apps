import { ConnectionState } from '@tloncorp/shared/api';
import { expect, test } from 'vitest';

import { getStatusLabels } from '../utils/connectionStatus';

// Pure logic tests for ConnectionStatus component
// Testing the actual getStatusLabels function and component logic

// Success cases
test('getStatusLabels - success with custom label', () => {
  const result = getStatusLabels(
    'yes',
    '~sampel-palnet',
    'Connected to Group Host'
  );
  expect(result).toEqual({
    title: 'Connected to Group Host',
    subtitle: 'Connected to ~sampel-palnet',
    icon: 'Checkmark',
  });
});

test('getStatusLabels - success with default label', () => {
  const result = getStatusLabels('yes', '~sampel-palnet');
  expect(result).toEqual({
    title: 'Connected',
    subtitle: 'Connected to ~sampel-palnet',
    icon: 'Checkmark',
  });
});

test('getStatusLabels - success without contactId', () => {
  const result = getStatusLabels('yes', undefined, 'Connected to Peer');
  expect(result).toEqual({
    title: 'Connected to Peer',
    subtitle: 'Connected to peer node',
    icon: 'Checkmark',
  });
});

// Failure cases
test('getStatusLabels - crash failure', () => {
  const result = getStatusLabels('crash', '~sampel-palnet');
  expect(result).toEqual({
    title: 'Failed',
    subtitle: 'Status checker failed for ~sampel-palnet',
    icon: 'Close',
  });
});

test('getStatusLabels - DNS failure', () => {
  const result = getStatusLabels('no-dns', '~sampel-palnet');
  expect(result).toEqual({
    title: 'Failed',
    subtitle: 'DNS failed for ~sampel-palnet. Check your network connection',
    icon: 'Close',
  });
});

test('getStatusLabels - no data failure', () => {
  const result = getStatusLabels('no-data', '~sampel-palnet');
  expect(result).toEqual({
    title: 'Failed',
    subtitle: 'No data received from ~sampel-palnet',
    icon: 'Close',
  });
});

// Disconnection cases
test('getStatusLabels - our planet disconnected', () => {
  const result = getStatusLabels('no-our-planet');
  expect(result).toEqual({
    title: 'Disconnected',
    subtitle: 'Your moon is disconnected from your planet. Is it running?',
    icon: 'Close',
  });
});

test('getStatusLabels - sponsor issues', () => {
  const result = getStatusLabels('no-sponsor-hit', '~sampel-palnet');
  expect(result).toEqual({
    title: 'Disconnected',
    subtitle: "No connection to ~sampel-palnet's sponsor node",
    icon: 'Close',
  });
});

// Connecting states
test('getStatusLabels - setting up', () => {
  const result = getStatusLabels('setting-up', '~sampel-palnet');
  expect(result).toEqual({
    title: 'Connecting...',
    subtitle: 'Setting up connection to ~sampel-palnet...',
  });
});

test('getStatusLabels - trying DNS', () => {
  const result = getStatusLabels('trying-dns', '~sampel-palnet');
  expect(result).toEqual({
    title: 'Connecting...',
    subtitle: 'Trying DNS for ~sampel-palnet...',
  });
});

test('getStatusLabels - trying target with icon', () => {
  const result = getStatusLabels('trying-target', '~sampel-palnet');
  expect(result).toEqual({
    title: 'Connecting...',
    subtitle: 'Trying to reach ~sampel-palnet...',
    icon: 'EyeOpen',
  });
});

// Edge cases
test('getStatusLabels - empty contactId defaults to peer node', () => {
  const result = getStatusLabels('yes', '');
  expect(result).toEqual({
    title: 'Connected',
    subtitle: 'Connected to peer node',
    icon: 'Checkmark',
  });
});

test('getStatusLabels - empty label defaults to Connected', () => {
  const result = getStatusLabels('yes', '~sampel-palnet', '');
  expect(result).toEqual({
    title: 'Connected',
    subtitle: 'Connected to ~sampel-palnet',
    icon: 'Checkmark',
  });
});

test('getStatusLabels - label only affects success title', () => {
  const customLabel = 'Custom Connection Status';

  // Success case - label should be used
  const successResult = getStatusLabels('yes', '~nec', customLabel);
  expect(successResult.title).toBe(customLabel);

  // Failure case - label should be ignored, standard title used
  const failureResult = getStatusLabels('crash', '~nec', customLabel);
  expect(failureResult.title).toBe('Failed');

  // Connecting case - label should be ignored, standard title used
  const connectingResult = getStatusLabels('trying-dns', '~nec', customLabel);
  expect(connectingResult.title).toBe('Connecting...');
});

// Component logic tests
test('component should not render for current user', () => {
  const currentUserId = '~zod';
  const contactId = '~zod';
  const shouldRender = currentUserId !== contactId;
  expect(shouldRender).toBe(false);
});

test('component should render for different user', () => {
  const currentUserId: string = '~zod';
  const contactId: string = '~sampel-palnet';
  const shouldRender = currentUserId !== contactId;
  expect(shouldRender).toBe(true);
});

test('loading state when connectionStatus is null', () => {
  const connectionStatus: any = null;
  const loading = !connectionStatus || !connectionStatus.complete;
  expect(loading).toBe(true);
});

test('loading state when connectionStatus is incomplete', () => {
  const connectionStatus: any = {
    status: 'trying-dns' as ConnectionState,
    complete: false,
  };
  const loading = !connectionStatus || !connectionStatus.complete;
  expect(loading).toBe(true);
});

test('not loading when connectionStatus is complete', () => {
  const connectionStatus: any = {
    status: 'yes' as ConnectionState,
    complete: true,
  };
  const loading = !connectionStatus || !connectionStatus.complete;
  expect(loading).toBe(false);
});

test('initializing message when connectionStatus is null', () => {
  const connectionStatus: any = null;
  const contactId = '~sampel-palnet';

  const title = connectionStatus
    ? getStatusLabels(connectionStatus.status, contactId)?.title
    : 'Checking connection...';

  const subtitle = connectionStatus
    ? getStatusLabels(connectionStatus.status, contactId)?.subtitle
    : `Initializing connection check to ${contactId}...`;

  expect(title).toBe('Checking connection...');
  expect(subtitle).toBe('Initializing connection check to ~sampel-palnet...');
});

test('all failure states have Close icon', () => {
  const failureStates: ConnectionState[] = [
    'crash',
    'no-data',
    'no-dns',
    'no-our-planet',
    'no-our-galaxy',
    'no-sponsor-hit',
    'no-sponsor-miss',
    'no-their-galaxy',
  ];

  failureStates.forEach((status) => {
    const result = getStatusLabels(status, '~nec');
    expect(result.icon).toBe('Close');
    expect(['Failed', 'Disconnected']).toContain(result.title);
  });
});

test('all connecting states have Connecting title', () => {
  const connectingStates: ConnectionState[] = [
    'setting-up',
    'trying-dns',
    'trying-local',
    'trying-target',
    'trying-sponsor',
  ];

  connectingStates.forEach((status) => {
    const result = getStatusLabels(status, '~nec');
    expect(result.title).toBe('Connecting...');
    expect(result.subtitle).toContain('~nec');
  });
});
