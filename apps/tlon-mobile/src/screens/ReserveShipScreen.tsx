import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  configureApi,
  getLandscapeAuthCookie,
  updateNickname,
  updateTelemetrySetting,
} from '@tloncorp/shared/dist/api';
import { preSig } from '@urbit/aura';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import { LoadingSpinner } from '../components/LoadingSpinner';
import { useBranch } from '../contexts/branch';
import { useShip } from '../contexts/ship';
import {
  allocateReservedShip,
  getHostingUser,
  getReservableShips,
  getShipAccessCode,
  getShipsWithStatus,
  reserveShip as reserveShipApi,
} from '../lib/hostingApi';
import { connectNotifyProvider } from '../lib/notificationsApi';
import type { OnboardingStackParamList } from '../types';
import { trackError, trackOnboardingAction } from '../utils/posthog';
import { getShipFromCookie, getShipUrl } from '../utils/ship';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ReserveShip'>;

export const ReserveShipScreen = ({
  navigation,
  route: {
    params: { user, signUpExtras },
  },
}: Props) => {
  const [{ state, error }, setState] = useState<{
    state: 'loading' | 'booting' | 'error';
    error?: string;
  }>({
    state: 'loading',
  });
  const { setShip } = useShip();
  const tailwind = useTailwind();
  const { clearLure } = useBranch();

  const startShip = useCallback(
    async (shipIds: string[]) => {
      // Fetch statuses for the user's ships and start any required booting/resuming
      const shipsWithStatus = await getShipsWithStatus(shipIds);
      if (!shipsWithStatus) {
        return setState({
          state: 'error',
          error: "Sorry, we couldn't find an active Urbit ID for your account.",
        });
      }

      const { status, shipId } = shipsWithStatus;

      // If user is in the sign up flow, send them to fill out some extra details
      if (
        signUpExtras?.nickname === undefined &&
        signUpExtras?.telemetry === undefined
      ) {
        return navigation.navigate('SetNickname', {
          user: await getHostingUser(user.id),
          signUpExtras: { nickname: preSig(shipId) },
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
          error: "Sorry, we couldn't log you into your Urbit ID.",
        });
      }

      const ship = getShipFromCookie(authCookie);
      configureApi(ship, shipUrl);

      if (signUpExtras?.nickname) {
        try {
          await updateNickname(signUpExtras.nickname);
        } catch (err) {
          console.error('Error setting nickname:', err);
          if (err instanceof Error) {
            trackError(err);
          }
        }
      }

      if (signUpExtras?.notificationToken) {
        try {
          await connectNotifyProvider(signUpExtras.notificationToken);
        } catch (err) {
          console.error('Error connecting push notifications provider:', err);
          if (err instanceof Error) {
            trackError(err);
          }
        }
      }

      if (signUpExtras?.telemetry !== undefined) {
        try {
          await updateTelemetrySetting(signUpExtras.telemetry);
        } catch (err) {
          console.error('Error setting telemetry:', err);
          if (err instanceof Error) {
            trackError(err);
          }
        }
      }

      // We are done using the saved lure link, it can be cleared before dropping user in the app
      clearLure();

      // Set the ship info in the main context to navigate to chat view
      setShip(
        {
          ship,
          shipUrl,
        },
        authCookie
      );
    },
    [user, signUpExtras, navigation, clearLure]
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
                'Sorry, we could no longer find an Urbit ID for you. Please try again later.',
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
              'We were not able to reserve your Urbit ID. Please try again later.',
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
          error: "Sorry, we couldn't boot your Urbit. Please try again later.",
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
    <View
      style={tailwind(
        'p-6 h-full flex items-center justify-center bg-white dark:bg-black'
      )}
    >
      {state === 'loading' ? (
        <>
          <LoadingSpinner />
          <Text
            style={tailwind(
              'mt-4 text-center text-tlon-black-80 dark:text-white text-lg font-medium'
            )}
          >
            Getting your Urbit ready...
          </Text>
        </>
      ) : state === 'booting' ? (
        <>
          <LoadingSpinner />
          <Text
            style={tailwind(
              'mt-4 text-center text-tlon-black-80 dark:text-white text-lg font-medium'
            )}
          >
            Booting your Urbit...
          </Text>
          <Text
            style={tailwind(
              'text-center text-tlon-black-80 dark:text-white text-lg font-medium'
            )}
          >
            This may take a few minutes.
          </Text>
        </>
      ) : null}
    </View>
  );
};
