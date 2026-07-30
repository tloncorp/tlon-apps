import { Text, View } from '@tloncorp/ui';
import { ReactNode, useEffect } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { getVariableValue, useTheme } from 'tamagui';

export function HeaderAnimatedCluster({
  children,
  isLoading,
  leftAlignWhileLoading = false,
}: {
  children: ReactNode;
  isLoading: boolean;
  leftAlignWhileLoading?: boolean;
}) {
  const clusterTranslateY = useSharedValue(0);
  const clusterScale = useSharedValue(1);
  const clusterWidth = useSharedValue(0);

  useEffect(() => {
    if (isLoading) {
      clusterTranslateY.value = withTiming(-9, {
        duration: 195,
        easing: Easing.out(Easing.cubic),
      });
      clusterScale.value = withTiming(0.86, {
        duration: 195,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    clusterTranslateY.value = withDelay(
      68,
      withTiming(0, {
        duration: 195,
        easing: Easing.out(Easing.cubic),
      })
    );
    clusterScale.value = withDelay(
      68,
      withTiming(1, {
        duration: 195,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [clusterScale, clusterTranslateY, isLoading]);

  const animatedClusterStyle = useAnimatedStyle(() => {
    const scale = clusterScale.value;
    const leftScaleCompensation = leftAlignWhileLoading
      ? -((1 - scale) * clusterWidth.value) / 2
      : 0;

    return {
      transform: [
        { translateX: leftScaleCompensation },
        { translateY: clusterTranslateY.value },
        { scale },
      ],
    };
  });

  return (
    <Animated.View
      onLayout={(event) => {
        clusterWidth.value = event.nativeEvent.layout.width;
      }}
      style={animatedClusterStyle}
    >
      {children}
    </Animated.View>
  );
}

export function HeaderAnimatedTitle({
  title,
  isLoading,
  loadingText,
  leftAlignLoadingText = false,
  titleMaxWidth,
  loadingTextMaxWidth = 240,
}: {
  title: string;
  isLoading: boolean;
  loadingText: string;
  leftAlignLoadingText?: boolean;
  titleMaxWidth?: number | 'unset';
  loadingTextMaxWidth?: number;
}) {
  const theme = useTheme();
  const loadingOpacity = useSharedValue(0);
  const loadingTranslateY = useSharedValue(6);
  const spinnerRotation = useSharedValue(0);
  const isAndroid = Platform.OS === 'android';
  const spinnerSize = isAndroid ? 10 : 8;
  const spinnerBorderWidth = 1;
  const spinnerGap = 6;
  const loadingRowWidth = loadingTextMaxWidth + spinnerSize + spinnerGap;

  useEffect(() => {
    if (isLoading) {
      loadingOpacity.value = withTiming(1, {
        duration: 135,
        easing: Easing.out(Easing.cubic),
      });
      loadingTranslateY.value = withTiming(0, {
        duration: 165,
        easing: Easing.out(Easing.cubic),
      });
      spinnerRotation.value = 0;
      spinnerRotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false
      );
      return;
    }

    loadingOpacity.value = withTiming(0, {
      duration: 120,
      easing: Easing.in(Easing.cubic),
    });
    loadingTranslateY.value = withTiming(-6, {
      duration: 135,
      easing: Easing.in(Easing.cubic),
    });
    cancelAnimation(spinnerRotation);
    spinnerRotation.value = 0;

    return () => {
      cancelAnimation(spinnerRotation);
      spinnerRotation.value = 0;
    };
  }, [isLoading, loadingOpacity, loadingTranslateY, spinnerRotation]);

  const animatedLoadingStyle = useAnimatedStyle(() => {
    return {
      opacity: loadingOpacity.value,
      transform: [
        {
          translateX:
            !leftAlignLoadingText && loadingRowWidth ? -loadingRowWidth / 2 : 0,
        },
        { translateY: loadingTranslateY.value },
      ],
    };
  });

  const animatedSpinnerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${spinnerRotation.value}deg` }],
    };
  });

  const spinnerColor = getVariableValue(theme.secondaryText);
  const spinnerStrokeStyle = {
    borderColor: spinnerColor,
    borderTopColor: 'transparent',
  };

  return (
    <View
      height="$4xl"
      alignItems="center"
      justifyContent="center"
      overflow="visible"
    >
      <Text
        size="$label/2xl"
        color="$primaryText"
        numberOfLines={1}
        maxWidth={titleMaxWidth}
        testID="ScreenHeaderTitle"
      >
        {title}
      </Text>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 36,
            left: leftAlignLoadingText ? 0 : '50%',
            width: loadingRowWidth,
            height: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: leftAlignLoadingText ? 'flex-start' : 'center',
          },
          animatedLoadingStyle,
        ]}
      >
        {isAndroid ? (
          <ActivityIndicator
            animating={isLoading}
            size={spinnerSize}
            color={spinnerColor}
            style={{
              width: spinnerSize,
              height: spinnerSize,
              marginRight: spinnerGap,
            }}
          />
        ) : (
          <Animated.View
            style={[
              {
                width: spinnerSize,
                height: spinnerSize,
                borderRadius: spinnerSize / 2,
                borderWidth: spinnerBorderWidth,
                marginRight: spinnerGap,
              },
              spinnerStrokeStyle,
              animatedSpinnerStyle,
            ]}
          />
        )}
        <Text
          size="$label/s"
          color="$secondaryText"
          trimmed={false}
          numberOfLines={1}
          maxWidth={loadingTextMaxWidth}
          testID="ScreenHeaderLoadingText"
        >
          {loadingText}
        </Text>
      </Animated.View>
    </View>
  );
}
