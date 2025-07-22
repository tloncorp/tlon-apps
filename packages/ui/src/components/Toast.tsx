import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Portal, getTokenValue, styled } from 'tamagui';

import { Text } from './TextV2';
import { View } from './View';

const ToastContext = createContext<{
  showToast: (options: { message: string; duration?: number }) => void;
  dismissToast: () => void;
} | null>(null);

type Toast = {
  message: string;
  duration: number;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
  }>({
    message: '',
    visible: false,
  });
  const queueRef = useRef<Array<Toast>>([]);
  const isProcessingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processQueue = useCallback(() => {
    if (isProcessingRef.current || queueRef.current.length === 0) return;

    const next = queueRef.current.shift();
    if (!next) return;

    isProcessingRef.current = true;

    setToast({ message: next.message, visible: true });
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      animationTimeoutRef.current = setTimeout(() => {
        isProcessingRef.current = false;
        processQueue();
      }, 300);
    }, next.duration);
  }, []);

  const showToast = useCallback(
    ({ message, duration = 3000 }: { message: string; duration?: number }) => {
      queueRef.current.push({ message, duration });
      processQueue();
    },
    [processQueue]
  );

  const dismissToast = useCallback(() => {
    if (toast.visible) {
      // Clear existing timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      
      // Start dismiss animation
      setToast((t) => ({ ...t, visible: false }));
      animationTimeoutRef.current = setTimeout(() => {
        isProcessingRef.current = false;
        processQueue();
      }, 300);
    }
  }, [toast.visible, processQueue]);

  // Cleanup timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <Portal>
        <ToastView 
          visible={toast.visible} 
          message={toast.message} 
          onDismiss={dismissToast}
        />
      </Portal>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx.showToast;
}

export function useDismissToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useDismissToast must be used within a ToastProvider');
  return ctx.dismissToast;
}

const ToastBox = styled(View, {
  backgroundColor: '$background',
  borderRadius: '$2xl',
  paddingVertical: '$m',
  paddingHorizontal: '$xl',
  maxWidth: 360,
  alignItems: 'center',
  justifyContent: 'center',
});

const ToastText = styled(Text, {
  color: '$positiveActionText',
  size: '$label/m',
  textAlign: 'center',
});

function ToastView({
  visible,
  message,
  onDismiss,
}: {
  visible: boolean;
  message: string;
  onDismiss: () => void;
}) {
  const translateY = useSharedValue(40);
  const opacity = useSharedValue(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withTiming(40, {
        duration: 200,
        easing: Easing.in(Easing.cubic),
      });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    }),
    [translateY, opacity]
  );

  return (
    <Animated.View
      style={[
        {
          width: '100%',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          pointerEvents: 'box-none',
        },
        animatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <Pressable onPress={onDismiss} disabled={!visible}>
        <ToastBox
          backgroundColor={'$positiveBackground'}
          marginBottom={(insets.bottom + getTokenValue('$5xl', 'size')) as number}
          testID="ToastMessage"
        >
          <ToastText>{message}</ToastText>
        </ToastBox>
      </Pressable>
    </Animated.View>
  );
}
