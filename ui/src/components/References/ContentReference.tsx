import React from 'react';
import { nestToFlag } from '@/logic/utils';
import { Cite } from '@/types/chat';
import { udToDec } from '@urbit/api';
import CurioReference from './CurioReference';
// eslint-disable-next-line import/no-cycle
import WritReference from './WritReference';
import GroupReference from './GroupReference';
import NoteReference from './NoteReference';
import AppReference from './AppReference';

function ContentReference({ cite }: { cite: Cite }) {
  if ('group' in cite) {
    return <GroupReference flag={cite.group} />;
  }

  if ('desk' in cite) {
    const { desk } = cite.desk;
    return <AppReference desk={desk} />;
  }

  if ('chan' in cite) {
    const { nest, where } = cite.chan;
    const [app, chFlag] = nestToFlag(cite.chan.nest);
    const segments = where.split('/');

    if (app === 'heap') {
      const idCurio = udToDec(segments[2]);
      return <CurioReference chFlag={chFlag} nest={nest} idCurio={idCurio} />;
    }
    if (app === 'chat') {
      const idWrit = `${segments[2]}/${segments[3]}`;
      return <WritReference chFlag={chFlag} nest={nest} idWrit={idWrit} />;
    }
    if (app === 'diary') {
      const idNote = udToDec(segments[2]);
      return <NoteReference chFlag={chFlag} nest={nest} id={idNote} />;
    }
  }

  return null;
}

export default React.memo(ContentReference);
