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

  const timezoneResponse = await fetch(
    `https://api.geotimezone.com/public/timezone?latitude=${latitude}&longitude=${longitude}`
  );
  const timezone = await timezoneResponse.json();
  console.log('timezone', timezone);

  const profileLocation: domain.ProfileDeviceLocation = {
    type: 'device',
    address: place.address,
    placeId: place.place_id,
    ianaTimezone: timezone?.['iana_timezone'],
    latitude,
    longitude,
  };

  return profileLocation;
}
