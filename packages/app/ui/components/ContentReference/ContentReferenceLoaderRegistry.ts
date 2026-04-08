import { ContentReference } from '@tloncorp/shared/domain';
import React from 'react';

import { ReferenceProps } from './Reference';

export const IsInsideReferenceContext = React.createContext(false);
export const useIsInsideReference = () =>
  React.useContext(IsInsideReferenceContext);

export type ContentReferenceLoaderProps = ReferenceProps & {
  reference: ContentReference;
};

type LoaderComponent = React.ComponentType<ContentReferenceLoaderProps>;

// Module-level registry. ContentReference.tsx registers ContentReferenceLoader
// here at module load time, breaking the circular import with BlockRenderer.tsx.
// By render time, all modules are loaded and the registry is populated.
let _loader: LoaderComponent | null = null;

export function registerContentReferenceLoader(loader: LoaderComponent) {
  _loader = loader;
}

export function ContentReferenceLoaderProxy(
  props: ContentReferenceLoaderProps
) {
  if (!_loader) {
    return null;
  }
  return React.createElement(_loader, props);
}
