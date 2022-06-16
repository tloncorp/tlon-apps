import React from 'react';
import GroupActions from './GroupActions';

export default {
  component: 'GroupActions',
  title: 'GroupActions',
};

export function Text() {
  return <GroupActions flag={'~zod/test'} />;
}
