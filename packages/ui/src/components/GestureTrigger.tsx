import * as React from 'react';

type GestureTriggerProps = {
  children: React.ReactElement;
  id: string;
};

export function GestureTrigger({ children, id: _id }: GestureTriggerProps) {
  return <>{children}</>;
}
