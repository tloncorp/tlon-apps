import * as api from '@tloncorp/shared/api';
import * as domain from '@tloncorp/shared/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Switch, useWindowDimensions } from 'react-native';
import { XStack, YStack, styled } from 'tamagui';

import { useLocation } from '../hooks/useLocation';
import { triggerHaptic } from '../utils';
import { Button } from './Button';
import { ControlledTextField, ToggleGroupInput } from './Form';
import Pressable from './Pressable';
import { Text } from './TextV2';

export function LocationPicker(props: {
  initialLocation: domain.ProfileLocation | null;
  onLocationChange: (newLocation: domain.ProfileLocation | null) => void;
}) {
  const [locationEnabled, setLocationEnabled] = useState<boolean>(
    props.initialLocation !== null
  );
  const [tab, setTab] = useState<'device' | 'custom'>(
    props.initialLocation?.type ?? 'device'
  );
  const location = useLocation();
  const [profileLocation, setProfileLocation] =
    useState<domain.ProfileLocation | null>(props.initialLocation ?? null);

  const updateLocation = useCallback(
    (newLocation: domain.ProfileLocation | null) => {
      setProfileLocation(newLocation);
      props.onLocationChange(newLocation);
    },
    [props]
  );

  const switchLocationEnabled = useCallback(
    (newVal: boolean) => {
      setLocationEnabled(newVal);
      if (!newVal) {
        updateLocation(null);
      }
    },
    [setLocationEnabled, updateLocation]
  );

  const switchTabs = useCallback(
    (newTab: string) => {
      const newVal = newTab as 'device' | 'custom';
      setTab(newVal);
      if (newTab === 'device') {
        updateLocation(
          props.initialLocation?.type === newVal ? props.initialLocation : null
        );
      }
    },
    [props.initialLocation, updateLocation]
  );

  const {
    control,
    handleSubmit,
    watch,
    formState: { isDirty, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      customLocation: (props.initialLocation?.type === 'custom'
        ? props.initialLocation.value
        : '') as string,
    },
  });

  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === 'customLocation') {
        const customLocation = value.customLocation as string;
        const trimmed = customLocation?.trim();

        if (trimmed) {
          updateLocation({
            type: 'custom',
            value: trimmed,
          });
        } else {
          updateLocation(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, updateLocation]);

  const onPressUseLocation = useCallback(async () => {
    triggerHaptic('baseButtonClick');
    console.log(`use location pressed`, location);
    if (!location.isAvailable) {
      if (location.canRequest) {
        const permGranted = await location.requestPermission();
        if (!permGranted) {
          return;
        }
      } else {
        return;
      }
    }
    const currLoc = await location.getCurrentLocation();
    console.log(`got current location`, currLoc);
    const processed = await api.processDeviceLocation({
      latitude: currLoc.coords.latitude,
      longitude: currLoc.coords.longitude,
    });
    updateLocation(processed);
  }, [location, updateLocation]);

  return (
    <YStack
      marginTop="$m"
      gap="$2xl"
      borderWidth={1}
      borderColor="$border"
      padding="$m"
      borderRadius="$l"
      justifyContent="center"
    >
      <XStack alignItems="center" paddingVertical="$m">
        <Text size="$label/l" color="$secondaryText" marginRight="$l">
          Display location
        </Text>
        <Switch value={locationEnabled} onValueChange={switchLocationEnabled} />
      </XStack>

      {locationEnabled && (
        <ToggleGroupInput
          options={[
            { value: 'device', label: 'Device' },
            { value: 'custom', label: 'Custom' },
          ]}
          value={tab}
          onChange={switchTabs}
        />
      )}

      {locationEnabled && tab === 'device' && (
        <>
          {profileLocation && profileLocation.type === 'device' && (
            <Text size="$body" color="$primaryText" textAlign="center">
              {getAddressDisplay(profileLocation.address)}
            </Text>
          )}
          {location.isAvailable || location.canRequest ? (
            <Button hero onPress={onPressUseLocation}>
              <Button.Text>
                {profileLocation && profileLocation.type === 'device'
                  ? 'Refresh '
                  : 'Use current'}{' '}
                location
              </Button.Text>
            </Button>
          ) : (
            <Button hero onPress={location.openSettings}>
              <Button.Text>Enable location permission</Button.Text>
            </Button>
          )}
        </>
      )}

      {locationEnabled && tab === 'custom' && (
        <>
          <ControlledTextField
            name="customLocation"
            control={control}
            inputProps={{
              placeholder: 'Outer space...',
            }}
            rules={{
              maxLength: {
                value: 30,
                message: 'Your location is limited to 30 characters',
              },
            }}
          />
        </>
      )}
    </YStack>
  );
}

function getAddressDisplay(address: domain.ProfileDeviceLocation['address']) {
  if (!address) {
    return 'Unknown';
  }

  if (address.county && address.state) {
    return `${address.county}, ${address.state}`;
  }

  return address.country;
}

const PaddedBlock = styled(YStack, {
  borderRadius: '$2xl',
  padding: '$2xl',
  gap: '$l',
  justifyContent: 'center',
  backgroundColor: '$background',
});

export function LocationDisplayWidget({
  location,
}: {
  location: domain.ProfileLocation;
}) {
  const [displayState, setDisplayState] = useState<1 | 2 | 3 | 4>(1);
  const [localTime, setLocalTime] = useState<string | null>(null);
  const windowDimensions = useWindowDimensions();

  // const toggleDisplayState = useCallback(() => {
  //   setDisplayState((prev) => ((prev % 4) + 1) as 1 | 2 | 3 | 4);
  // }, []);
  const toggleDisplayState = useCallback(() => {
    setDisplayState((prev) => {
      if (prev === 1) return 2;
      if (prev === 2) return 4;
      return 1; // when prev is 4, go back to 1
    });
  }, []);

  useEffect(() => {
    let intervalId: any | null = null;

    // Only start the timer if we're in the correct display state and have timezone
    if (
      [3, 4].includes(displayState) &&
      location.type === 'device' &&
      location.ianaTimezone
    ) {
      // Set initial time immediately
      setLocalTime(getLocalTime(location.ianaTimezone));

      // Update every second
      intervalId = setInterval(() => {
        setLocalTime(getLocalTime(location.ianaTimezone!));
      }, 1000);
    }

    // Cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [location, displayState]);

  if (location.type === 'custom') {
    return (
      <PaddedBlock
        padding="$2xl"
        width={(windowDimensions.width - 36) / 2}
        height={120}
        gap="$2xl"
      >
        <Text size="$label/xl" color="$tertiaryText">
          Location
        </Text>
        <Text size="$label/l" color="$primaryText">
          {location.value}
        </Text>
      </PaddedBlock>
    );
  }

  return (
    <Pressable onPress={toggleDisplayState}>
      {displayState === 4 ? (
        <LinearGradient
          style={{
            width: (windowDimensions.width - 36) / 2,
            height: 120,
            padding: 20, // assuming $2xl is 20
            borderRadius: 24,
            opacity: 0.95,
          }}
          {...getTimeBasedGradient(localTime ?? '00:00:00')}
        >
          <YStack gap="$2xl">
            <Text size="$label/xl" color="white">
              Location
            </Text>
            <YStack gap="$l">
              <Text size="$label/l" color="white">
                {' '}
              </Text>
              <Text size="$label/l" color="white">
                {localTime}
              </Text>
            </YStack>
          </YStack>
        </LinearGradient>
      ) : (
        <PaddedBlock
          padding="$2xl"
          width={(windowDimensions.width - 36) / 2}
          height={120}
          gap="$2xl"
        >
          <Text size="$label/xl" color="$tertiaryText">
            Location
          </Text>
          {displayState === 1 && (
            <>
              <Text size="$label/l" color="$primaryText">
                {getAddressDisplay(location.address)}
              </Text>
            </>
          )}
          {displayState === 2 && (
            <YStack gap="$l">
              <XStack justifyContent="space-between">
                <Text size="$label/l" color="$tertiaryText">
                  Lat
                </Text>
                <Text size="$label/l" color="$primaryText">
                  {location.latitude.toFixed(4)}
                </Text>
              </XStack>
              <XStack justifyContent="space-between">
                <Text size="$label/l" color="$tertiaryText">
                  Long
                </Text>
                <Text size="$label/l" color="$primaryText">
                  {location.longitude.toFixed(4)}
                </Text>
              </XStack>
            </YStack>
          )}
          {displayState === 3 && (
            <YStack gap="$l">
              <Text size="$label/l" color="$primaryText">
                {' '}
              </Text>
              <Text size="$label/l" color="$primaryText">
                {localTime}
              </Text>
            </YStack>
          )}
        </PaddedBlock>
      )}
    </Pressable>
  );
}

function getLocalTime(ianaTimezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return formatter.format(new Date());
}

function getTimeBasedGradient(timeString: string): {
  colors: string[];
  locations: number[];
} {
  const hour = parseInt(timeString.split(':')[0], 10);

  // Define time ranges and their corresponding gradients
  if (hour >= 0 && hour < 5) {
    // Night (midnight to pre-dawn)
    return {
      colors: ['#1a202c', '#1a365d'],
      locations: [0, 1],
    };
  } else if (hour >= 5 && hour < 7) {
    // Dawn
    return {
      colors: ['#1a365d', '#d53f8c', '#dd6b20'],
      locations: [0, 0.5, 1],
    };
  } else if (hour >= 7 && hour < 9) {
    // Sunrise
    return {
      colors: ['#dd6b20', '#ecc94b', '#63b3ed'],
      locations: [0, 0.5, 1],
    };
  } else if (hour >= 9 && hour < 16) {
    // Day
    return {
      colors: ['#63b3ed', '#4299e1'],
      locations: [0, 1],
    };
  } else if (hour >= 16 && hour < 19) {
    // Sunset
    return {
      colors: ['#63b3ed', '#dd6b20', '#805ad5'],
      locations: [0, 0.5, 1],
    };
  } else if (hour >= 19 && hour < 21) {
    // Twilight
    return {
      colors: ['#44337a', '#1a365d'],
      locations: [0, 1],
    };
  } else {
    // Night
    return {
      colors: ['#1a202c', '#1a365d'],
      locations: [0, 1],
    };
  }
}
