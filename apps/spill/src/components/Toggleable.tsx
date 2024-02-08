import {PropsWithChildren, useContext} from 'react';
import * as db from '@db';
import {StreamContext} from './StreamContext';

export default function Toggleable({
  target,
  children,
}: PropsWithChildren<{
  target: db.StreamViewSettingsKey;
}>) {
  const interfaceContext = useContext(StreamContext).view;
  if (!interfaceContext || interfaceContext[target] !== false) {
    return children;
  }
  return null;
}
