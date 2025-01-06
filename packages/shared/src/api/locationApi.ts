import * as domain from '../domain';

export async function processDeviceLocation({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}): Promise<domain.ProfileDeviceLocation> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
  );
  const place = await response.json();
  console.log('place', place);

  const timezone = await getDeviceTimezone();
  console.log('timezone', timezone);

  const profileLocation: domain.ProfileDeviceLocation = {
    type: 'device',
    address: place.address,
    placeId: place.place_id,
    ianaTimezone: timezone,
    latitude,
    longitude,
  };

  return profileLocation;
}

export function getDeviceTimezone(): string {
  // Works in both web and React Native!
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
