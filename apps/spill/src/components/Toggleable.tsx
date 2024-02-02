import {useContext} from 'react';
import * as db from '@db';
import {StreamContext} from './StreamContext';

export default function Toggleable({
  target,
  children,
}: {
  target: db.StreamViewSettingsKey;
  children: React.ReactNode;
}) {
  const interfaceContext = useContext(StreamContext).view;
  if (!interfaceContext || interfaceContext[target] !== false) {
    return children;
  }
  return null;
}
