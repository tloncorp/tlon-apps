import type { ReactNode } from 'react';
import type { BrowserSecureField } from './browserCredentialHandoff';

export type BrowserSecureTextInputProps = {
  field: BrowserSecureField;
  value: string;
  disabled: boolean;
  concealed: boolean;
  rightControls?: ReactNode;
  onChange(value: string): void;
  onSubmit(): void;
};
