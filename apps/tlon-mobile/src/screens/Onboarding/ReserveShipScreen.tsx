import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useSignupContext } from '@tloncorp/app/contexts/signup';
import {
  allocateReservedShip,
  getHostingUser,
  getReservableShips,
  getShipAccessCode,
  getShipsWithStatus,
  reserveShip as reserveShipApi,
} from '@tloncorp/app/lib/hostingApi';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { getShipFromCookie, getShipUrl } from '@tloncorp/app/utils/ship';
import {
  configureApi,
  getLandscapeAuthCookie,
} from '@tloncorp/shared/dist/api';
import { Spinner, Text, View, YStack } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ReserveShip'>;

export const ReserveShipScreen = ({
  navigation,
  route: {
    params: { user },
  },
}: Props) => {
  const [{ state, error }, setState] = useState<{
    state: 'loading' | 'booting' | 'error';
    error?: string;
  }>({
    state: 'loading',
  });
  const signupContext = useSignupContext();
  const { setShip } = useShip();

  const startShip = useCallback(
    async (shipIds: string[]) => {
      // Fetch statuses for the user's ships and start any required booting/resuming
      const shipsWithStatus = await getShipsWithStatus(shipIds);
      if (!shipsWithStatus) {
        // you can only have gotten to this screen if a new hosting account was created and ship
        // was reserved. If we don't see the ship status, assume it's still booting
        return setState({ state: 'booting' });
      }

      const { status, shipId } = shipsWithStatus;

      // If user is in the sign up flow, send them to fill out some extra details
      if (
        signupContext.nickname === undefined &&
        signupContext.telemetry === undefined
      ) {
        return navigation.navigate('SetNickname', {
          user: await getHostingUser(user.id),
        });
      }

      // If it's not ready, show the booting message
      if (status !== 'Ready') {
        return setState({ state: 'booting' });
      }

      // If it's ready, fetch the access code and auth cookie
      const { code: accessCode } = await getShipAccessCode(shipId);
      const shipUrl = getShipUrl(shipId);
      const authCookie = await getLandscapeAuthCookie(shipUrl, accessCode);
      if (!authCookie) {
        return setState({
          state: 'error',
          error: "Sorry, we couldn't log you into your ship.",
        });
      }

      const ship = getShipFromCookie(authCookie);
      configureApi(ship, shipUrl);

      // Set the ship info in the main context to navigate to chat view
      setShip({
        ship,
        shipUrl,
        authCookie,
        authType: 'hosted',
      });
    },
    [
      navigation,
      setShip,
      signupContext.nickname,
      signupContext.telemetry,
      user.id,
    ]
  );

  const reserveShip = useCallback(
    async (skipShipId?: string) => {
      const shipIds = user.ships ?? [];

      // User doesn't have any ships assigned to them yet
      if (shipIds.length === 0) {
        try {
          // Get list of reservable ships and choose one that's ready for distribution
          const ships = await getReservableShips(user.id);
          const ship = ships.find(
            ({ id, readyForDistribution }) =>
              id !== skipShipId && readyForDistribution
          );
          if (!ship) {
            return setState({
              state: 'error',
              error:
                'Sorry, we could no longer find a ship for you. Please try again later.',
            });
          }

          // Reserve this ship and check it was successful
          const { reservedBy } = await reserveShipApi(user.id, ship.id);
          if (reservedBy !== user.id) {
            return reserveShip(ship.id);
          }

          // Finish allocating this ship to the user
          await allocateReservedShip(user.id);
          shipIds.push(ship.id);
          trackOnboardingAction({
            actionName: 'Urbit ID Selected',
            ship: ship.id,
          });
        } catch (err) {
          console.error('Error reserving ship:', err);
          if (err instanceof Error) {
            trackError(err);
          }

          return setState({
            state: 'error',
            error:
              'We were not able to reserve your ship. Please try again later.',
          });
        }
      }

      // Start the ship
      try {
        await startShip(shipIds);
      } catch (err) {
        console.error('Error starting ship:', err);
        if (err instanceof Error) {
          trackError(err);
        }

        return setState({
          state: 'error',
          error: "Sorry, we couldn't boot your ship. Please try again later.",
        });
      }
    },
    [user]
  );

  useEffect(() => {
    reserveShip();
  }, [reserveShip]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (state === 'booting') {
      timer = setInterval(reserveShip, 5_000);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [state]);

  useEffect(() => {
    if (error) {
      Alert.alert('An error occurred', error, [
        {
          text: 'OK',
          onPress: () => navigation.popToTop(),
          style: 'cancel',
        },
      ]);
    }
  }, [error, navigation]);

  // Disable back button if no error occurred
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!error) {
          e.preventDefault();
        }
      }),
    [navigation, error]
  );

  return (
    <View flex={1} padding="$2xl" alignItems="center" justifyContent="center">
      {state === 'loading' ? (
        <YStack alignItems="center" gap="$xl">
          <Spinner size="large" />
          <Text textAlign="center" color="$primaryText">
            Getting your ship ready...
          </Text>
        </YStack>
      ) : state === 'booting' ? (
        <YStack alignItems="center" gap="$xl">
          <Spinner size="large" />
          <Text textAlign="center" color="$primaryText">
            Booting your ship...
          </Text>
          <Text textAlign="center" color="$secondaryText" fontSize="$m">
            This may take a few minutes.
          </Text>
        </YStack>
      ) : null}
    </View>
  );
};
