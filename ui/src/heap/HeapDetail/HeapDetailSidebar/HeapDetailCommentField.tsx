import React, { useState } from 'react';
import { useParams } from 'react-router';
import { JSONContent } from '@tiptap/core';
import HeapTextInput from '@/heap/HeapTextInput';
import useNest from '@/logic/useNest';
import { nestToFlag } from '@/logic/utils';
import { decToUd } from '@urbit/api';

export default function HeapDetailCommentField() {
  const nest = useNest();
  const { idCurio } = useParams();
  const [, chFlag] = nestToFlag(nest);
  const [draftText, setDraftText] = useState<JSONContent>();
  const replyToTime = idCurio ? decToUd(idCurio) : undefined;

  return (
    <div className="border-t-2 border-gray-50 p-3 sm:p-4">
      <HeapTextInput
        flag={chFlag}
        draft={draftText}
        setDraft={setDraftText}
        replyTo={replyToTime}
        placeholder="Comment"
        comment={true}
      />
    </div>
  );
}
