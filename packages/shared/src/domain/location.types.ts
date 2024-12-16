export interface ProfileDeviceLocation {
  type: 'device';
  latitude: number;
  longitude: number;
  ianaTimezone?: string;
  address?: {
    country: string;
    state?: string;
    county?: string;
    city?: string;
  };
  placeId?: string;
}

export interface ProfileCustomLocation {
  type: 'custom';
  value: string;
}

export type ProfileLocation = ProfileDeviceLocation | ProfileCustomLocation;

export function locationsEquivalent(
  a: ProfileLocation | null,
  b: ProfileLocation | null
): boolean {
  if (a === null && b === null) {
    return true;
  }

  if (a === null || b === null) {
    return false;
  }

  if (a.type !== b.type) {
    return false;
  }

  if (a.type === 'device' && b.type === 'device') {
    return a.latitude === b.latitude && a.longitude === b.longitude;
  }

  if (a.type === 'custom' && b.type === 'custom') {
    return a.value === b.value;
  }

  return false;
}
