import React from 'react';
import { Link } from 'react-router-dom';
import { useWritByFlagAndWritId } from '@/state/chat';
import { useChannelPreview } from '@/state/groups';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ReferenceBar from './ReferenceBar';

export default function WritReference({
  chFlag,
  nest,
  idWrit,
}: {
  chFlag: string;
  nest: string;
  idWrit: string;
}) {
  const writObject = useWritByFlagAndWritId(chFlag, idWrit);
  const preview = useChannelPreview(nest);

  // TODO: handle failure for useWritByFlagAndWritId call.
  if (!writObject) {
    return <LoadingSpinner />;
  }

  const { writ } = writObject;
  const time = bigInt(udToDec(writ.seal.id.split('/')[1]));

  if (!('story' in writ.memo.content)) {
    return null;
  }

  return (
    <div className="writ-inline-block group">
      <Link
        to={
          preview?.group
            ? `/groups/${preview.group.flag}/channels/${nest}?msg=${writ.seal.id}`
            : ''
        }
        className="cursor-pointer p-2 group-hover:bg-gray-50"
      >
        <ChatContent story={writ.memo.content.story} />
      </Link>
      <ReferenceBar
        nest={nest}
        time={time}
        author={writ.memo.author}
        unSubbed
        groupFlag={preview?.group.flag}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
      />
    </div>
  );
}
