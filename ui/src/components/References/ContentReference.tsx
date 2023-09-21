import React from 'react';
import { udToDec } from '@urbit/api';
import { nestToFlag } from '@/logic/utils';
import { Cite } from '@/types/dms';
// eslint-disable-next-line import/no-cycle
import CurioReference from './CurioReference';
// eslint-disable-next-line import/no-cycle
import WritChanReference from './WritChanReference';
// eslint-disable-next-line import/no-cycle
import GroupReference from './GroupReference';
// eslint-disable-next-line import/no-cycle
import NoteReference from './NoteReference';
// eslint-disable-next-line import/no-cycle
import AppReference from './AppReference';
// eslint-disable-next-line import/no-cycle
import BaitReference from './BaitReference';
// eslint-disable-next-line import/no-cycle
import NoteCommentReference from './NoteCommentReference';

function ContentReference({
  cite,
  isScrolling = false,
  contextApp,
  plain,
  children,
}: {
  cite: Cite;
  isScrolling?: boolean;
  contextApp?: string;
  plain?: boolean;
  children?: React.ReactNode;
}) {
  if ('group' in cite) {
    return (
      <GroupReference
        plain={plain}
        contextApp={contextApp}
        flag={cite.group}
        isScrolling={isScrolling}
      >
        {children}
      </GroupReference>
    );
  }

  if ('desk' in cite) {
    const { flag } = cite.desk;
    return flag ? <AppReference flag={flag} isScrolling={isScrolling} /> : null;
  }

  if ('bait' in cite) {
    return (
      <BaitReference
        bait={cite.bait}
        contextApp={contextApp}
        isScrolling={isScrolling}
      >
        {children}
      </BaitReference>
    );
  }
  if ('chan' in cite) {
    const { nest, where } = cite.chan;
    const [app, chFlag] = nestToFlag(cite.chan.nest);
    const segments = where.split('/');

    if (app === 'heap') {
      const idCurio = udToDec(segments[2]);
      return (
        <CurioReference
          nest={nest}
          idCurio={idCurio}
          isScrolling={isScrolling}
          contextApp={contextApp}
        >
          {children}
        </CurioReference>
      );
    }
    if (app === 'chat') {
      const idWrit = `${segments[2]}/${segments[3]}`;
      return (
        <WritChanReference
          isScrolling={isScrolling}
          chFlag={chFlag}
          nest={nest}
          contextApp={contextApp}
          idWrit={idWrit}
        >
          {children}
        </WritChanReference>
      );
    }
    if (app === 'diary') {
      const idNote = udToDec(segments[2]);
      const idQuip = segments[4] ? udToDec(segments[4]) : null;

      if (idQuip) {
        return (
          <NoteCommentReference
            isScrolling={isScrolling}
            chFlag={chFlag}
            nest={nest}
            noteId={idNote}
            quipId={idQuip}
            contextApp={contextApp}
          >
            {children}
          </NoteCommentReference>
        );
      }

      return (
        <NoteReference
          chFlag={chFlag}
          nest={nest}
          id={idNote}
          isScrolling={isScrolling}
          contextApp={contextApp}
        >
          {children}
        </NoteReference>
      );
    }
  }

  return null;
}

export default React.memo(ContentReference);
