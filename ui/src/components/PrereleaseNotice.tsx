import React from 'react';
import useAppName from '@/logic/useAppName';
import ButterBar from './ButterBar';

export default function PrereleaseNotice() {
  const app = useAppName();

  return (
    <ButterBar
      dismissKey={`prerelease-notice-dismissed`}
      message={`Reminder: you are using a Beta version of ${app}. Everything you write or create, including groups and messages, will be deleted prior to official launch.`}
    />
  );
}
