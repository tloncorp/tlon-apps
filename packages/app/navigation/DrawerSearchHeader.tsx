import { Icon, Pressable } from '@tloncorp/ui';
import {
  type ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { type LayoutChangeEvent, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { View, getTokenValue, useTheme } from 'tamagui';

import { RawTextInput, type TextInputRef, interactionWithTiming } from '../ui';
import {
  GlassSurface,
  supportsLiquidGlass,
} from '../ui/components/GlassSurface';
import { DRAWER_CONTROL_SHADOW } from './drawerControlShadow';

// The tabs' own height, so the header is the same size with the field showing
// as without it and the list below never shifts when one replaces the other.
const HEADER_HEIGHT = getTokenValue('$4xl', 'size');
// Smaller than the footer's controls: those float over the list and have to be
// found with a thumb, while this one sits in a row of text labels and would
// crowd them at the footer's size.
const SEARCH_CONTROL_SIZE = 40;
const SEARCH_CONTROL_RADIUS = SEARCH_CONTROL_SIZE / 2;
const SEARCH_GLYPH_SIZE = 20;
// What the tabs leave free for the control beside them.
const TABS_CLEARANCE = SEARCH_CONTROL_SIZE + getTokenValue('$m', 'space');
const OPEN_DURATION = 250;

const usesIOSGlass = supportsLiquidGlass();

/**
 * The panel's header: the tabs, and a search control beside them that widens
 * into a field across the whole header when pressed.
 *
 * It widens from where it stands rather than a field replacing a button, the
 * way the system's own toolbar search does: the glyph rides the field's
 * leading edge out across the tabs, so what was pressed and what is now being
 * typed into read as the one control. The tabs fade under it; the list below
 * is searched across both of their halves, so there is nothing for them to
 * choose between while it is open.
 *
 * Open is held by the caller rather than here, because the caller's list is
 * what the query narrows and because it outlives the panel being shut: a
 * search is a way of getting somewhere, and the user who went there and came
 * back is still in the middle of it.
 */
export const DrawerSearchHeader = forwardRef<
  TextInputRef,
  {
    /** The tabs, shown for as long as the field is not. */
    children: ReactNode;
    open: boolean;
    query: string;
    /** Refuses the control, not a field already open. */
    disabled: boolean;
    onOpen: () => void;
    onChangeQuery: (query: string) => void;
    /** The field's `X`: clears the query and gives the tabs back. */
    onClose: () => void;
  }
>(function DrawerSearchHeader(
  { children, open, query, disabled, onOpen, onChangeQuery, onClose },
  inputRef
) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const progress = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    const target = open ? 1 : 0;
    // Already there on mount, and an animation to where it stands would only
    // hold off the app's other interactions while it ran.
    if (progress.value === target) {
      return;
    }
    progress.value = interactionWithTiming(target, {
      duration: OPEN_DURATION,
      easing: Easing.inOut(Easing.quad),
    });
  }, [open, progress]);

  const controlStyle = useAnimatedStyle(
    () => ({
      width: interpolate(
        progress.value,
        [0, 1],
        [SEARCH_CONTROL_SIZE, Math.max(width, SEARCH_CONTROL_SIZE)]
      ),
    }),
    [progress, width]
  );
  // Gone before the field has crossed them, so they are never read through
  // the glass as it passes over.
  const tabsStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(progress.value, [0, 0.5], [1, 0], 'clamp'),
    }),
    [progress]
  );
  // And the field's contents arrive once there is room to read them in.
  const fieldStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(progress.value, [0.5, 1], [0, 1], 'clamp'),
    }),
    [progress]
  );

  const focusField = useCallback(() => {
    if (inputRef && typeof inputRef !== 'function') {
      inputRef.current?.focus();
    }
  }, [inputRef]);

  return (
    <View
      height={HEADER_HEIGHT}
      justifyContent="center"
      onLayout={handleLayout}
    >
      <Animated.View
        style={tabsStyle}
        // Faded is not gone: without this they would still take a tap through
        // the field's glass, and a screen reader would still offer them.
        pointerEvents={open ? 'none' : 'auto'}
        aria-hidden={open}
      >
        <View paddingRight={TABS_CLEARANCE}>{children}</View>
      </Animated.View>
      <Animated.View style={[styles.control, controlStyle]}>
        <GlassSurface
          isInteractive
          style={[
            styles.surface,
            // Glass brings its own fill. Everywhere else the control needs
            // one, or the field it opens into would be a caret on the panel.
            usesIOSGlass
              ? null
              : { backgroundColor: theme.secondaryBackground?.val },
          ]}
        >
          <Pressable
            // Open, the glyph is part of the field, and pressing it is
            // pressing the field.
            onPress={open ? focusField : disabled ? undefined : onOpen}
            disabled={!open && disabled}
            accessibilityRole="button"
            accessibilityLabel="Search"
            accessibilityState={{ disabled: !open && disabled, expanded: open }}
            testID="TopLevelDrawerSearch"
            width={SEARCH_CONTROL_SIZE}
            height={SEARCH_CONTROL_SIZE}
            flexShrink={0}
            alignItems="center"
            justifyContent="center"
            opacity={!open && disabled ? 0.4 : 1}
          >
            <Icon
              type="Search"
              customSize={[SEARCH_GLYPH_SIZE, SEARCH_GLYPH_SIZE]}
              // A button's glyph shut, the field's placeholder grey open.
              color={open ? '$tertiaryText' : '$primaryText'}
            />
          </Pressable>
          {open ? (
            <Animated.View style={[styles.field, fieldStyle]}>
              <RawTextInput
                ref={inputRef}
                flex={1}
                paddingVertical={0}
                value={query}
                onChangeText={onChangeQuery}
                placeholder="Search"
                placeholderTextColor="$tertiaryText"
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                returnKeyType="search"
                enablesReturnKeyAutomatically
                accessibilityLabel="Search chats"
                testID="TopLevelDrawerSearchInput"
              />
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close search"
                testID="TopLevelDrawerSearchClose"
                width={SEARCH_CONTROL_SIZE}
                height={SEARCH_CONTROL_SIZE}
                flexShrink={0}
                alignItems="center"
                justifyContent="center"
              >
                <Icon
                  type="Close"
                  customSize={[SEARCH_GLYPH_SIZE, SEARCH_GLYPH_SIZE]}
                  color="$secondaryText"
                />
              </Pressable>
            </Animated.View>
          ) : null}
        </GlassSurface>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  control: {
    // Anchored at the trailing edge, so widening carries its leading edge —
    // and the glyph on it — out across the tabs.
    position: 'absolute',
    right: 0,
    top: (HEADER_HEIGHT - SEARCH_CONTROL_SIZE) / 2,
    height: SEARCH_CONTROL_SIZE,
    borderRadius: SEARCH_CONTROL_RADIUS,
    ...DRAWER_CONTROL_SHADOW,
  },
  surface: {
    flex: 1,
    borderRadius: SEARCH_CONTROL_RADIUS,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
