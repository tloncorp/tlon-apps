import {
  Button,
  Pressable,
  Text,
  TextArea,
  XStack,
  YStack,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import { useCurrentSession } from '@tloncorp/shared/store';
import { Accelerometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  KeyboardAvoidingView,
  Modal,
  Platform,
} from 'react-native';

const logger = createDevLogger('PoorUxReport', false);
const SHAKE_UPDATE_INTERVAL_MS = 250;
const SHAKE_DELTA_THRESHOLD = 2.5;
const SHAKE_HITS_REQUIRED = 3;
const SHAKE_HITS_WINDOW_MS = 1000;
const SHAKE_COOLDOWN_MS = 3000;
const FOREGROUND_SHAKE_GRACE_MS = 1500;

export function usePoorUxShakeReport() {
  const session = useCurrentSession();
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState('');
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const ignoreShakesUntilRef = useRef<number>(
    Date.now() + FOREGROUND_SHAKE_GRACE_MS
  );

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      appStateRef.current = nextState;
      if (nextState === 'active') {
        ignoreShakesUntilRef.current = Date.now() + FOREGROUND_SHAKE_GRACE_MS;
        setVisible(false);
        setDetails('');
        return;
      }

      setVisible(false);
      setDetails('');
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let lastMagnitude = 1;
    let shakeHits = 0;
    let lastHitAt = 0;
    let cooldownUntil = 0;

    Accelerometer.setUpdateInterval(SHAKE_UPDATE_INTERVAL_MS);

    const subscription = Accelerometer.addListener(
      ({ x, y, z }: { x: number; y: number; z: number }) => {
        const now = Date.now();
        if (appStateRef.current !== 'active') {
          return;
        }
        if (now < ignoreShakesUntilRef.current) {
          return;
        }
        if (now < cooldownUntil) {
          return;
        }

        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const delta = Math.abs(magnitude - lastMagnitude);
        lastMagnitude = magnitude;

        if (delta < SHAKE_DELTA_THRESHOLD) {
          return;
        }

        if (now - lastHitAt > SHAKE_HITS_WINDOW_MS) {
          shakeHits = 0;
        }
        lastHitAt = now;
        shakeHits += 1;

        if (shakeHits >= SHAKE_HITS_REQUIRED) {
          cooldownUntil = now + SHAKE_COOLDOWN_MS;
          shakeHits = 0;
          setVisible((prev) => (prev ? prev : true));
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const handleCancel = useCallback(() => {
    setVisible(false);
    setDetails('');
  }, []);

  const handleSubmit = useCallback(() => {
    logger.trackEvent('Poor UX Reported', {
      details: details.trim(),
      hasDetails: details.trim().length > 0,
      syncPhase: session?.phase ?? null,
      isSyncing: session?.isSyncing ?? null,
    });
    setVisible(false);
    setDetails('');
  }, [details, session]);

  const modal = (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          flex={1}
          onPress={handleCancel}
          backgroundColor="$darkOverlay"
          justifyContent="center"
          alignItems="center"
          padding="$xl"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            width="100%"
            maxWidth={500}
          >
            <YStack
              backgroundColor="$secondaryBackground"
              borderRadius="$xl"
              borderWidth={1}
              borderColor="$border"
              padding="$2xl"
              gap="$m"
            >
              <Text fontSize="$l" color="$primaryText" fontWeight="700">
                Report Poor UX
              </Text>
              <TextArea
                minHeight={120}
                backgroundColor="$background"
                borderColor="$secondaryBorder"
                borderWidth={1}
                borderRadius="$l"
                padding="$m"
                color="$primaryText"
                size="$m"
                autoFocus
                multiline
                textAlignVertical="top"
                placeholder="What went wrong?"
                placeholderTextColor="$gray400"
                value={details}
                onChangeText={setDetails}
              />
              <Text fontSize="$xs" color="$tertiaryText">
                sync: {session?.phase ?? 'n/a'} | changes:{' '}
                {session?.isSyncing ? 'syncing' : 'idle'}
              </Text>
              <XStack justifyContent="flex-end" gap="$s" paddingVertical="$m">
                <Button
                  preset="secondaryOutline"
                  size="small"
                  label="Cancel"
                  onPress={handleCancel}
                />
                <Button
                  preset="primary"
                  size="small"
                  label="Submit"
                  onPress={handleSubmit}
                />
              </XStack>
            </YStack>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );

  return { poorUxReportModal: modal };
}
