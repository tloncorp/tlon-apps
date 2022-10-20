import React from 'react';
import useAppName from '@/logic/useAppName';
import ButterBar from './ButterBar';

export default function AlphaNotice() {
  const app = useAppName();

  return (
    <ButterBar
      dismissKey={`${app}-alpha-notice-dismissed`}
      message={`Reminder: you are using an Alpha version of ${app}. Everything you write or create, including groups and messages, will be deleted prior to official launch.`}
    />
  );
}
