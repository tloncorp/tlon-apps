import React from 'react';
import { useParams } from 'react-router-dom';
import { whomIsDm } from '../logic/utils';
import Dm from './Dm';
import MultiDm from './MultiDm';

export default function Message() {
  const whom = useParams<{ ship: string }>().ship!;
  const isDm = whomIsDm(whom);

  return isDm ? <Dm /> : <MultiDm />;
}
