import { TextInputProps } from 'react-native';

import { PastedFile } from './pastedImage';

export interface PasteableTextInputProps extends TextInputProps {
  onPasteFiles?: (files: PastedFile[]) => void;
}
