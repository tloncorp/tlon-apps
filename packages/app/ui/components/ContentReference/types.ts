import type { ContentReference } from '@tloncorp/shared';
import { ComponentType } from 'react';

import type { ReferenceProps } from './Reference';

export interface ContentReferenceLoaderProps extends ReferenceProps {
  reference: ContentReference;
}

export type ContentReferenceLoaderComponent =
  ComponentType<ContentReferenceLoaderProps>;
