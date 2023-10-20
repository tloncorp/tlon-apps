import React from 'react';
import { udToDec } from '@urbit/api';
import { nestToFlag } from '@/logic/utils';
import { Cite } from '@/types/channel';
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

  // We no longer support references for graph content (and we never truly did? :()

  // if ('bait' in cite) {
  // return (
  // <BaitReference
  // bait={cite.bait}
  // contextApp={contextApp}
  // isScrolling={isScrolling}
  // >
  // {children}
  // </BaitReference>
  // );
  // }

  if ('chan' in cite) {
    const { nest, where } = cite.chan;
    const [app, chFlag] = nestToFlag(cite.chan.nest);
    const segments = where.split('/');

    if (app === 'heap') {
      const idCurio = udToDec(segments[2]);
      const idReply = segments[3];

      if (idReply) {
        return (
          <WritChanReference
            isScrolling={isScrolling}
            nest={nest}
            contextApp={contextApp}
            idWrit={idCurio}
            idReply={idReply}
          >
            {children}
          </WritChanReference>
        );
      }

      return (
        <CurioReference
          nest={nest}
          idCurio={idCurio}
          idReply={idReply}
          isScrolling={isScrolling}
          contextApp={contextApp}
        >
          {children}
        </CurioReference>
      );
    }
    if (app === 'chat') {
      const idWrit = segments[2];
      const idReply = segments[3];
      return (
        <WritChanReference
          isScrolling={isScrolling}
          nest={nest}
          contextApp={contextApp}
          idWrit={idWrit}
          idReply={idReply}
        >
          {children}
        </WritChanReference>
      );
    }
    if (app === 'diary') {
      const idNote = udToDec(segments[2]);
      const idReply = segments[4] ? udToDec(segments[4]) : null;

      if (idReply) {
        return (
          <WritChanReference
            isScrolling={isScrolling}
            nest={nest}
            contextApp={contextApp}
            idWrit={idNote}
            idReply={idReply}
          >
            {children}
          </WritChanReference>
        );
      }

      return (
        <NoteReference
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
