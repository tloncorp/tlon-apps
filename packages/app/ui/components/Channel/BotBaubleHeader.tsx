import { NavigationContext } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useConnectionStatus } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import {
  Icon,
  type IconType,
  Text,
  mobileTypeStyles,
  triggerHaptic,
} from '@tloncorp/ui';
import {
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'tamagui/linear-gradient';
import { useTheme } from 'tamagui';

import { useInstalledNavigationOptions } from '../../../navigation/useInstalledNavigationOptions';
import { useContact } from '../../contexts/appDataContext';
import { useConversationScrollViewNativeID } from '../../contexts/scroll';
import { ContactAvatar } from '../Avatar';
import { useContactName } from '../ContactNameV2';
import { GlassSurface, supportsLiquidGlass } from '../GlassSurface';
import { ScrollEdgeElementContainer } from '../ScrollEdgeElementContainer';
import {
  type BotBaubleState,
  getBotBaubleBeat,
  getBotBaubleState,
  getBotBaubleStatusText,
} from './botBaubleState';
import { useConversationComputingState } from './useConversationComputingState';

// The avatar tile is top-aligned with the controls on either side and hangs
// below them; the name sits in a capsule tucked under it, overlapping its edge.
const TOP_GAP = 8;
const CONTROL_SIZE = 44;
const ACTION_WIDTH = 40;
const AVATAR_SIZE = 64;
// The glyph fills the tile edge to edge; only a soft shadow sets it off.
const TILE_SIZE = AVATAR_SIZE;
const TILE_RADIUS = 16;
const AVATAR_RADIUS = TILE_RADIUS;
const BOTTOM_GAP = 8;
const NAME_HEIGHT = mobileTypeStyles['$label/l'].lineHeight + 4;
const NAME_OVERLAP = 3;
// Where native scroll edges are missing, a fade covers the controls row and
// runs this far past it.
const FADE_TAIL = 24;
const RESERVED_HEIGHT =
  TOP_GAP + TILE_SIZE + NAME_HEIGHT - NAME_OVERLAP + BOTTOM_GAP;

// Motion vocabulary. Moves speed out of their start and ease into their end;
// anticipation eases both ways. Settles are springs with little damping, so
// the tile wobbles like jelly before it comes to rest.
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN = Easing.bezier(0.55, 0, 1, 0.45);
const ELASTIC = { damping: 9, stiffness: 320, mass: 0.7 };
const SWING = { damping: 11, stiffness: 220, mass: 0.7 };
const HEAVY = { damping: 16, stiffness: 70, mass: 1 };
const TICK_ANGLE = 2.5;

const hiddenHeaderOptions: NativeStackNavigationOptions = {
  headerShown: false,
};

/** Height the bauble covers; conversation content clears it. */
export function useBotBaubleHeaderHeight() {
  const { top } = useSafeAreaInsets();
  return top + RESERVED_HEIGHT;
}

/** A header action, drawn as an icon in the capsule on the right. */
export interface BotBaubleAction {
  id: string;
  icon: IconType;
  label: string;
  onPress: () => void;
  /** Tints the icon, as the live header does for an active context lens. */
  active?: boolean;
  testID?: string;
}

/**
 * The bauble header, revived for conversations with a bot: the bot's avatar
 * in a small floating tile with its name beneath, ticking back and forth
 * while the bot works.
 */
export function BotBaubleHeader({
  channel,
  botId,
  goBack,
  goToProfile,
  actions,
}: {
  channel: db.Channel;
  botId: string;
  goBack?: () => void;
  goToProfile: () => void;
  actions: BotBaubleAction[];
}) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const navigation = useContext(NavigationContext);
  const reduceMotion = useReducedMotion();
  const contact = useContact(botId);
  const name = useContactName(botId) ?? botId;
  const computing = useConversationComputingState(channel.id);
  const connectionStatus = useConnectionStatus();
  const state = getBotBaubleState({
    liveness: domain.botLivenessOf(contact),
    computing,
    connectionStatus,
  });
  const statusText = getBotBaubleStatusText(state, computing);
  const toolKey = computing?.toolCalls.map((call) => call.label).join('|');
  const motion = useBotTileMotion({ state, reduceMotion, toolKey });

  useInstalledNavigationOptions(navigation ?? undefined, hiddenHeaderOptions);

  const handleTilePress = useCallback(() => {
    triggerHaptic('baseButtonClick');
    goToProfile();
  }, [goToProfile]);
  const background = theme.background?.val as string | undefined;
  const transparentBackground = theme.transparentBackground?.val as
    | string
    | undefined;
  const scrollViewNativeID = useConversationScrollViewNativeID();
  const glass = supportsLiquidGlass();
  // Only the status bar and the controls row are softened; the avatar and its
  // name float over the conversation, as in the original bauble.
  const controlsHeight = insets.top + TOP_GAP + CONTROL_SIZE;
  const fadeHeight = controlsHeight + FADE_TAIL;

  return (
    <View
      pointerEvents="box-none"
      // iOS only hit-tests and exposes children inside their parent's bounds,
      // so the root spans everything the header draws.
      style={[styles.root, { height: insets.top + RESERVED_HEIGHT }]}
      testID="BotBaubleHeader"
    >
      {/* With Liquid Glass, iOS frosts the conversation under the controls and
          this only washes it a little lighter; elsewhere the fade does it all. */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          background ?? '$background',
          background ?? '$background',
          transparentBackground ?? '$transparentBackground',
        ]}
        locations={[0, controlsHeight / fadeHeight, 1]}
        style={[styles.fade, { height: fadeHeight, opacity: glass ? 0.6 : 1 }]}
      />

      {/* iOS draws its soft scroll edge behind this strip, so the
          conversation frosts under the controls as it does under a navigation
          bar. The controls stay outside it: glass inside an edge container
          loses its own tint and vanishes over a plain background. */}
      <ScrollEdgeElementContainer
        edge="top"
        scrollViewNativeID={scrollViewNativeID}
        pointerEvents="none"
        style={[styles.controlsRow, { height: controlsHeight }]}
      />
      {goBack ? (
        <ChromeButton
          label="Back"
          onPress={goBack}
          style={[styles.control, { top: insets.top + TOP_GAP, left: 16 }]}
          testID="BotBaubleBack"
        >
          <Icon type="ChevronLeft" color="$primaryText" />
        </ChromeButton>
      ) : null}
      {actions.length > 0 ? (
        <ChromeSurface
          style={[styles.actions, { top: insets.top + TOP_GAP, right: 16 }]}
        >
          {actions.map((action) => (
            <Pressable
              key={action.id}
              accessibilityLabel={action.label}
              accessibilityRole="button"
              accessibilityState={
                action.active == null ? undefined : { selected: action.active }
              }
              hitSlop={4}
              onPress={action.onPress}
              style={styles.action}
              testID={action.testID ?? action.id}
            >
              <Icon
                type={action.icon}
                color={action.active ? '$positiveActionText' : '$primaryText'}
              />
            </Pressable>
          ))}
        </ChromeSurface>
      ) : null}

      <View
        style={[styles.tileRow, { top: insets.top + TOP_GAP }]}
        pointerEvents="box-none"
      >
        <Pressable
          accessibilityLabel={statusText ? `${name}, ${statusText}` : name}
          accessibilityRole="button"
          accessibilityHint="Opens the bot's profile"
          onPress={handleTilePress}
          onPressIn={motion.pressIn}
          onPressOut={motion.pressOut}
          testID="BotBaubleTile"
          style={styles.tilePressable}
        >
          <Animated.View style={[styles.tile, motion.tileStyle]}>
            {/* One glyph of the bot's sigil, in the bot's own colors. */}
            <ContactAvatar
              contactId={botId}
              singleGlyph
              size="$5xl"
              borderRadius={AVATAR_RADIUS}
            />
          </Animated.View>
          {/* Glass tucked just under the tile, which sits in front of it, as
              Muse's name capsule does. Regular glass keeps a visible shell
              over a plain background, where clear glass would vanish. */}
          <GlassSurface
            glassEffectStyle="regular"
            style={[
              styles.name,
              glass
                ? null
                : {
                    backgroundColor: background,
                    borderColor: theme.border?.val as string | undefined,
                    borderWidth: StyleSheet.hairlineWidth,
                  },
            ]}
          >
            <Text size="$label/l" color="$primaryText" numberOfLines={1}>
              {name}
            </Text>
          </GlassSurface>
        </Pressable>
      </View>
    </View>
  );
}

/** Floating chrome: Liquid Glass where iOS has it, a raised chip elsewhere. */
function ChromeSurface({
  style,
  children,
}: {
  style: object | object[];
  children: ReactNode;
}) {
  const theme = useTheme();
  const glass = supportsLiquidGlass();
  return (
    <GlassSurface
      glassEffectStyle="regular"
      isInteractive
      style={[
        styles.chrome,
        !glass && {
          backgroundColor: theme.background?.val as string | undefined,
          borderColor: theme.border?.val as string | undefined,
          borderWidth: StyleSheet.hairlineWidth,
        },
        !glass && styles.raised,
        style,
      ]}
    >
      {children}
    </GlassSurface>
  );
}

function ChromeButton({
  label,
  onPress,
  style,
  testID,
  children,
}: {
  label: string;
  onPress: () => void;
  style: object | object[];
  testID: string;
  children: ReactNode;
}) {
  return (
    <ChromeSurface style={style}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        hitSlop={6}
        onPress={onPress}
        style={styles.chromePressable}
        testID={testID}
      >
        {children}
      </Pressable>
    </ChromeSurface>
  );
}

/**
 * Motion for the bot's tile, built from squash and stretch around its bottom
 * edge. `squash` is one value: positive squashes (shorter and wider),
 * negative stretches (taller and thinner), so volume is kept and an elastic
 * spring through zero reads as a wobble.
 *
 * While the bot works it ticks like an escapement: crouch, swing to one side
 * with a stretch, settle, hold. A tool call gets a hop, a reply a bounce, and
 * an offline bot slumps and goes still.
 */
function useBotTileMotion({
  state,
  reduceMotion,
  toolKey,
}: {
  state: BotBaubleState;
  reduceMotion: boolean;
  toolKey: string | undefined;
}) {
  const tilt = useSharedValue(0);
  const lift = useSharedValue(0);
  const squash = useSharedValue(state === 'offline' ? 0.03 : 0);
  const press = useSharedValue(0);
  const rest = useSharedValue(state === 'offline' ? 0.94 : 1);
  const previousState = useRef(state);
  const previousToolKey = useRef(toolKey);
  // A hop or bounce owns the tile until it lands; ticks wait their turn.
  const busyUntil = useRef(0);

  const hop = useCallback(
    (height: number) => {
      busyUntil.current = Date.now() + 700;
      tilt.value = withSpring(0, SWING);
      lift.value = withSequence(
        withTiming(0, { duration: 120 }),
        withTiming(-height, { duration: 200, easing: EASE_OUT }),
        withTiming(0, { duration: 170, easing: EASE_IN })
      );
      squash.value = withSequence(
        // Crouch.
        withTiming(0.07, { duration: 120, easing: EASE_IN_OUT }),
        // Launch, stretched.
        withTiming(-0.06, { duration: 110, easing: EASE_OUT }),
        // Round out at the top.
        withTiming(0, { duration: 160, easing: EASE_IN_OUT }),
        // Stretch into the fall.
        withTiming(-0.03, { duration: 100, easing: EASE_IN }),
        // Land.
        withTiming(0.08, { duration: 70, easing: EASE_OUT }),
        withSpring(0, ELASTIC)
      );
    },
    [lift, squash, tilt]
  );

  // Transitions between states each get one gesture.
  useEffect(() => {
    const previous = previousState.current;
    previousState.current = state;
    if (previous === state) return;

    const offline = state === 'offline';
    if (reduceMotion) {
      tilt.value = 0;
      lift.value = 0;
      squash.value = 0;
      rest.value = offline ? 0.94 : 1;
      return;
    }

    if (offline) {
      // Slump: lean back upright, sag and settle low.
      busyUntil.current = Date.now() + 700;
      tilt.value = withSpring(0, HEAVY);
      squash.value = withTiming(0.03, { duration: 600, easing: EASE_IN_OUT });
      rest.value = withTiming(0.94, { duration: 600, easing: EASE_IN_OUT });
      lift.value = withTiming(2, { duration: 600, easing: EASE_IN_OUT });
      return;
    }

    if (previous === 'offline') {
      // Back up: pop tall, then wobble into shape.
      rest.value = withSpring(1, ELASTIC);
      squash.value = withSequence(
        withTiming(-0.06, { duration: 180, easing: EASE_OUT }),
        withSpring(0, ELASTIC)
      );
      lift.value = withSpring(0, SWING);
      return;
    }

    if (isBusy(previous) && state === 'idle') {
      // The reply landed.
      hop(4);
      return;
    }

    if (!isBusy(state)) {
      tilt.value = withSpring(0, SWING);
    }
  }, [hop, lift, reduceMotion, rest, squash, state, tilt]);

  // The escapement: one tick per beat, alternating sides.
  useEffect(() => {
    const beat = getBotBaubleBeat(state);
    if (beat == null || reduceMotion) return;
    let side = 1;
    const tick = () => {
      if (Date.now() < busyUntil.current) return;
      tilt.value = withSequence(
        // Lean back a little before swinging over.
        withTiming(-side * 1, { duration: 140, easing: EASE_IN_OUT }),
        withSpring(side * TICK_ANGLE, SWING)
      );
      squash.value = withSequence(
        withTiming(0.035, { duration: 140, easing: EASE_IN_OUT }),
        withTiming(-0.03, { duration: 150, easing: EASE_OUT }),
        withSpring(0, ELASTIC)
      );
      side = -side;
    };
    tick();
    const interval = setInterval(tick, beat);
    return () => clearInterval(interval);
  }, [reduceMotion, squash, state, tilt]);

  // A new tool call gets a hop.
  useEffect(() => {
    const previous = previousToolKey.current;
    previousToolKey.current = toolKey;
    if (reduceMotion || state !== 'working' || toolKey === previous) return;
    hop(6);
  }, [hop, reduceMotion, state, toolKey]);

  const tileStyle = useAnimatedStyle(() => {
    const amount = squash.value + press.value;
    return {
      transform: [
        { translateY: lift.value },
        { rotate: `${tilt.value}deg` },
        { scaleX: (1 + amount) * rest.value },
        { scaleY: (1 - amount) * rest.value },
      ],
    };
  });

  const pressIn = useCallback(() => {
    press.value = withTiming(0.06, { duration: 110, easing: EASE_OUT });
  }, [press]);
  const pressOut = useCallback(() => {
    press.value = withSpring(0, ELASTIC);
  }, [press]);

  return { tileStyle, pressIn, pressOut };
}

function isBusy(state: BotBaubleState) {
  return state === 'thinking' || state === 'working';
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  controlsRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  control: {
    position: 'absolute',
    width: CONTROL_SIZE,
  },
  chrome: {
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
    overflow: 'hidden',
  },
  raised: {
    overflow: 'visible',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actions: {
    position: 'absolute',
    flexDirection: 'row',
    paddingHorizontal: 2,
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chromePressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileRow: {
    position: 'absolute',
    left: 72,
    right: 72,
    alignItems: 'center',
  },
  tilePressable: {
    alignItems: 'center',
    maxWidth: '100%',
  },
  name: {
    marginTop: -NAME_OVERLAP,
    height: NAME_HEIGHT,
    maxWidth: '100%',
    paddingHorizontal: 10,
    borderRadius: NAME_HEIGHT / 2,
    justifyContent: 'center',
    // Over a plain background glass has nothing to bend, so the shadow is
    // what gives the capsule its edge.
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tile: {
    zIndex: 1,
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: TILE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    // Squash and lean from the bottom edge, as if resting on a surface.
    transformOrigin: 'bottom',
    // A soft shadow that pools under the tile, so it sits above the
    // conversation rather than on it.
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
});
