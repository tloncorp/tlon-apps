import React from 'react';
import { GroupPreview } from '../../types/groups';
import GroupAvatar from '../GroupAvatar';

export default function GangPreview(props: { preview: GroupPreview }) {
  const { preview } = props;

  return (
    <div className="flex space-x-4 rounded border p-2">
      <GroupAvatar size="h-16 w-16" {...preview.meta} />
      <div className="flex flex-col justify-around">
        <h4 className="text-lg font-bold">{preview.meta.title}</h4>
        <p>{preview.meta.description}</p>
      </div>
    </div>
  );
}
