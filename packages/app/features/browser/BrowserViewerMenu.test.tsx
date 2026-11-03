import React from 'react';
import { Picker, Toggle } from '@expo/ui/swift-ui';
import { act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { BrowserViewerMenu } from './BrowserViewerMenu.ios';

vi.mock('@expo/ui/swift-ui', () => ({
  Host: 'Host',
  Menu: 'Menu',
  Picker: 'Picker',
  RNHostView: 'RNHostView',
  Text: 'Text',
  Toggle: 'Toggle',
}));
vi.mock('@expo/ui/swift-ui/modifiers', () => ({
  accessibilityLabel: (value: unknown) => ({ accessibilityLabel: value }),
  buttonStyle: (value: unknown) => ({ buttonStyle: value }),
  disabled: (value: unknown) => ({ disabled: value }),
  menuIndicator: (value: unknown) => ({ menuIndicator: value }),
  menuStyle: (value: unknown) => ({ menuStyle: value }),
  pickerStyle: (value: unknown) => ({ pickerStyle: value }),
  tag: (value: unknown) => ({ tag: value }),
}));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('tamagui', () => ({ useThemeName: () => 'light' }));
vi.mock('./BrowserViewerControls.native', () => ({
  BrowserControlMenuLabel: 'MenuLabel',
}));

describe('iOS browser view menu', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it('tracks the remote mode and refuses selection while control is unavailable', () => {
    const onSelect = vi.fn();
    const props = {
      topInset: 44,
      rightInset: 0,
      onSelect,
      onBrowserControlsChange: vi.fn(),
    };
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<BrowserViewerMenu {...props} ready mode="agent" />);
    });
    expect(renderer.root.findByType(Picker).props.selection).toBe('agent');
    act(() =>
      renderer.root.findByType(Picker).props.onSelectionChange('mobile')
    );
    expect(onSelect).toHaveBeenCalledWith('mobile');
    act(() => {
      renderer.update(
        <BrowserViewerMenu {...props} ready={false} mode="mobile" />
      );
    });
    const picker = renderer.root.findByType(Picker);
    expect(picker.props.selection).toBe('mobile');
    expect(picker.props.modifiers).toContainEqual({ disabled: true });
    act(() => picker.props.onSelectionChange('agent'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it('uses the viewer-confirmed toolbar state and disables unsupported viewers', () => {
    const onBrowserControlsChange = vi.fn();
    const props = {
      topInset: 44,
      rightInset: 0,
      ready: false,
      onSelect: vi.fn(),
      onBrowserControlsChange,
    };
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<BrowserViewerMenu {...props} />);
    });
    let toggle = renderer.root.findByType(Toggle);
    expect(toggle.props.modifiers).toContainEqual({ disabled: true });
    act(() => toggle.props.onIsOnChange(true));
    expect(onBrowserControlsChange).not.toHaveBeenCalled();
    act(() => {
      renderer.update(
        <BrowserViewerMenu {...props} browserControlsVisible={false} />
      );
    });
    toggle = renderer.root.findByType(Toggle);
    expect(toggle.props.isOn).toBe(false);
    // Toolbar visibility is local and does not require remote input control.
    act(() => toggle.props.onIsOnChange(true));
    expect(onBrowserControlsChange).toHaveBeenCalledWith(true);
    act(() => {
      renderer.update(<BrowserViewerMenu {...props} browserControlsVisible />);
    });
    expect(renderer.root.findByType(Toggle).props.isOn).toBe(true);
    act(() => renderer.unmount());
  });
});
