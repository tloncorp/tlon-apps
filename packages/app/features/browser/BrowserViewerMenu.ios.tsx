import {
  Host,
  Menu,
  Picker,
  RNHostView,
  Text,
  Toggle,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  disabled,
  menuIndicator,
  menuStyle,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { useThemeName } from 'tamagui';

import { BrowserControlMenuLabel } from './BrowserViewerControls.native';
import type {
  BrowserViewerMenuProps,
  BrowserViewMode,
} from './BrowserViewerMenu.types';

export function BrowserViewerMenu({
  topInset,
  rightInset,
  mode,
  ready,
  onSelect,
  browserControlsVisible,
  onBrowserControlsChange,
}: BrowserViewerMenuProps) {
  const themeName = useThemeName();
  return (
    <View
      style={{
        position: 'absolute',
        top: topInset + 12,
        right: rightInset + 12,
        width: 44,
        height: 44,
      }}
    >
      <Host
        style={{ width: 44, height: 44 }}
        ignoreSafeArea="all"
        colorScheme={themeName.startsWith('dark') ? 'dark' : 'light'}
      >
        <Menu
          label={
            <RNHostView matchContents>
              <BrowserControlMenuLabel />
            </RNHostView>
          }
          modifiers={[
            menuStyle('button'),
            buttonStyle('plain'),
            menuIndicator('hidden'),
            accessibilityLabel('Browser options'),
          ]}
        >
          <Picker<BrowserViewMode>
            label="View"
            selection={mode ?? 'agent'}
            onSelectionChange={(value) => {
              if (ready) onSelect(value);
            }}
            modifiers={[pickerStyle('inline'), disabled(!ready)]}
          >
            <Text modifiers={[tag('agent')]}>Agent View</Text>
            <Text modifiers={[tag('mobile')]}>Mobile View</Text>
          </Picker>
          <Toggle
            label="Show browser controls"
            isOn={browserControlsVisible ?? false}
            modifiers={[disabled(browserControlsVisible === undefined)]}
            onIsOnChange={(visible) => {
              if (browserControlsVisible !== undefined)
                onBrowserControlsChange(visible);
            }}
          />
        </Menu>
      </Host>
    </View>
  );
}
