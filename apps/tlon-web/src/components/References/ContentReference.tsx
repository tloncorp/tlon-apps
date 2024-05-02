import { Cite } from '@tloncorp/shared/dist/urbit/channel';
import { udToDec } from '@urbit/api';
import React from 'react';

import { nestToFlag } from '@/logic/utils';

import AppReference from './AppReference';
import CurioReference from './CurioReference';
import GroupReference from './GroupReference';
import NoteReference from './NoteReference';
import WritChanReference from './WritChanReference';

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
      const isThreadParent = idWrit === idReply;
      return (
        <WritChanReference
          isScrolling={isScrolling}
          nest={nest}
          contextApp={contextApp}
          idWrit={idWrit}
          idReply={isThreadParent ? undefined : idReply}
        >
          {children}
        </WritChanReference>
      );
    }
    if (app === 'diary') {
      const idNote = udToDec(segments[2]);
      const idReply = segments[3] ? udToDec(segments[3]) : null;

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
