import type { AppThemeName } from '@tloncorp/api';
import type { CustomThemeName } from '@tloncorp/shared/utils';

export type { AppThemeName };

export type { CustomThemeName };
export type AppTheme = AppThemeName | 'auto' | CustomThemeName;
