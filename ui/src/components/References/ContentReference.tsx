import React from 'react';
import { nestToFlag } from '@/logic/utils';
import { Cite } from '@/types/chat';
import { udToDec } from '@urbit/api';
// eslint-disable-next-line import/no-cycle
import CurioReference from './CurioReference';
// eslint-disable-next-line import/no-cycle
import WritChanReference from './WritChanReference';
import GroupReference from './GroupReference';
import NoteReference from './NoteReference';
import AppReference from './AppReference';
// eslint-disable-next-line import/no-cycle
import BaitReference from './BaitReference';

function ContentReference({
  cite,
  isScrolling = false,
}: {
  cite: Cite;
  isScrolling?: boolean;
}) {
  if ('group' in cite) {
    return <GroupReference flag={cite.group} isScrolling={isScrolling} />;
  }

  if ('desk' in cite) {
    const { flag } = cite.desk;
    return flag ? <AppReference flag={flag} isScrolling={isScrolling} /> : null;
  }

  if ('bait' in cite) {
    return <BaitReference bait={cite.bait} isScrolling={isScrolling} />;
  }
  if ('chan' in cite) {
    const { nest, where } = cite.chan;
    const [app, chFlag] = nestToFlag(cite.chan.nest);
    const segments = where.split('/');

    if (app === 'heap') {
      const idCurio = udToDec(segments[2]);
      return (
        <CurioReference
          chFlag={chFlag}
          nest={nest}
          idCurio={idCurio}
          isScrolling={isScrolling}
        />
      );
    }
    if (app === 'chat') {
      const idWrit = `${segments[2]}/${segments[3]}`;
      return (
        <WritChanReference
          isScrolling={isScrolling}
          chFlag={chFlag}
          nest={nest}
          idWrit={idWrit}
        />
      );
    }
    if (app === 'diary') {
      const idNote = udToDec(segments[2]);
      return (
        <NoteReference
          chFlag={chFlag}
          nest={nest}
          id={idNote}
          isScrolling={isScrolling}
        />
      );
    }
  }

  return null;
}

export default React.memo(ContentReference);
