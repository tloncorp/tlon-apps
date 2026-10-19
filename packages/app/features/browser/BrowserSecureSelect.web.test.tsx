// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BrowserSecureSelect } from './BrowserSecureSelect.web';
import type { BrowserSecureField } from './browserCredentialHandoff';

// Use the package's actual DOM select implementation, regardless of Vitest's
// default native module resolution.
vi.mock('@react-native-picker/picker', async () => ({
  Picker: (
    await vi.importActual<{ default: unknown }>(
      '@react-native-picker/picker/dist/module/Picker.web.js'
    )
  ).default,
}));
vi.mock('tamagui', () => ({
  useTheme: () => ({
    background: { val: '#fff' },
    primaryText: { val: '#000' },
    secondaryText: { val: '#777' },
  }),
  getConfig: () => ({ fonts: { body: { family: 'sans-serif' } } }),
}));
vi.mock('@tloncorp/ui', () => ({
  desktopTypeStyles: { '$label/xl': { fontSize: 16 } },
  Icon: () => null,
  Text: ({ children }: React.PropsWithChildren) => (
    <span aria-hidden>{children}</span>
  ),
}));
vi.mock('../../ui/components/Form/inputs', () => ({
  InputFrame: ({
    children,
    borderColor,
  }: React.PropsWithChildren<{ borderColor: string }>) => (
    <div data-testid="frame" data-border={borderColor}>
      {children}
    </div>
  ),
}));

const field: BrowserSecureField = {
  id: 'f0',
  purpose: 'country',
  label: 'Shipping country',
  inputType: 'select',
  required: true,
  options: [
    { value: '3', label: 'A country with a long display name' },
    { value: '7', label: 'Another country' },
  ],
};

afterEach(cleanup);

describe('web secure select', () => {
  it('uses accessible native select semantics and keeps the visible label in sync with opaque values', () => {
    const changed = vi.fn();
    function Form() {
      const [value, setValue] = useState('');
      return (
        <BrowserSecureSelect
          field={field}
          value={value}
          disabled={false}
          onChange={(next) => {
            changed(next);
            setValue(next);
          }}
        />
      );
    }
    render(<Form />);
    const select = screen.getByRole('combobox', {
      name: 'Shipping country',
    }) as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(select.options[0].disabled).toBe(true);
    fireEvent.focus(select);
    expect(screen.getByTestId('frame').getAttribute('data-border')).toBe(
      '$positiveActionText'
    );
    fireEvent.change(select, { target: { value: '3' } });
    expect(changed).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledWith('3');
    expect(select.value).toBe('3');
    expect(
      screen.getByText(field.options![0].label, { selector: 'span' })
        .textContent
    ).toBe(field.options![0].label);
    fireEvent.blur(select);
    expect(screen.getByTestId('frame').getAttribute('data-border')).toBe(
      '$border'
    );
  });

  it('disables the actual select during submission and reflects external value changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <BrowserSecureSelect
        field={field}
        value="3"
        disabled
        onChange={onChange}
      />
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    rerender(
      <BrowserSecureSelect
        field={field}
        value="7"
        disabled={false}
        onChange={onChange}
      />
    );
    expect(select.disabled).toBe(false);
    expect(select.value).toBe('7');
    expect(
      screen.getByText('Another country', { selector: 'span' })
    ).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
