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
    <div className="absolute bottom-5 flex h-24 w-full px-2">
      <HeapTextInput
        flag={chFlag}
        displayType="list"
        draft={draftText}
        setDraft={setDraftText}
        replyTo={replyToTime}
      />
    </div>
  );
}
