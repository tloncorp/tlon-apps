import React from 'react';

import ActivityIndicator from './ActivityIndicator';

export default function UnreadIndicator() {
  return (
    <ActivityIndicator count={0} bg={'transparent'} className="text-blue" />
  );
}
