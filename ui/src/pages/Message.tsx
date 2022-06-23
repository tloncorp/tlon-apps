import React from 'react';
import { useParams } from 'react-router-dom';
import Dm from './Dm';
import MultiDm from './MultiDm';

export default function Message() {
  const whom = useParams<{ ship: string }>().ship!;
  const isDm = whom.startsWith('~');

  return isDm ? <Dm /> : <MultiDm />;
}
