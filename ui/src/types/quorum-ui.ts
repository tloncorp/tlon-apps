import { Location } from 'react-router-dom';

export type ReactRouterState = null | {
  backgroundLocation?: Location;
  foregroundPayload?: string;
};

export interface ClassProps {
  className?: string;
}
