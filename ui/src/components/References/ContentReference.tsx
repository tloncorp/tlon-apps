import React from 'react';
import { nestToFlag } from '@/logic/utils';
import { Cite } from '@/types/chat';
import { udToDec } from '@urbit/api';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import CurioReference from './CurioReference';
// eslint-disable-next-line import/no-cycle
import WritReference from './WritReference';
import GroupReference from './GroupReference';
import NoteReference from './NoteReference';
import AppReference from './AppReference';
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
    const { desk } = cite.desk;
    return <AppReference desk={desk} isScrolling={isScrolling} />;
  }

  if ('bait' in cite) {
    const { old, flag, where } = cite.bait;
    return <BaitReference old={old} flag={flag} where={where} />;
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
        <WritReference
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
