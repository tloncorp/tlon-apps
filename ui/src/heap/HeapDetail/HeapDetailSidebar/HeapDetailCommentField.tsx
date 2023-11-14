import React, { useState } from 'react';
import { useParams } from 'react-router';
import { JSONContent } from '@tiptap/core';
import useNest from '@/logic/useNest';
import { nestToFlag } from '@/logic/utils';
import { useRouteGroup } from '@/state/groups';
import DiaryCommentField from '@/diary/DiaryCommentField';

export default function HeapDetailCommentField() {
  const nest = useNest();
  const { idTime } = useParams();
  const groupFlag = useRouteGroup();
  const [, chFlag] = nestToFlag(nest);
  const [draftText, setDraftText] = useState<JSONContent>();

  return (
    <div className="border-t-2 border-gray-50 p-3 sm:p-4">
      <DiaryCommentField
        groupFlag={groupFlag}
        flag={chFlag}
        han="heap"
        replyTo={idTime || ''}
      />
    </div>
  );
}
