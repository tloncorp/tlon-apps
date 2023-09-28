import React from 'react';
import { udToDec } from '@urbit/api';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { useGroup, useShoal } from '@/state/groups';
import { BaitCite } from '@/types/channel';
import ExclamationPoint from '../icons/ExclamationPoint';
// eslint-disable-next-line import/no-cycle
import CurioReference from './CurioReference';
// eslint-disable-next-line import/no-cycle
import NoteReference from './NoteReference';

// eslint-disable-next-line import/no-cycle
import WritBaitReference from './WritBaitReference';

function BaitReference({
  bait,
  isScrolling,
  contextApp,
  children,
}: {
  isScrolling: boolean;
  bait: BaitCite['bait'];
  contextApp?: string;
  children: React.ReactNode;
}) {
  const { group, graph, where } = bait;
  const theGroup = useGroup(group);
  const groupTitle = theGroup?.meta.title;
  const agent = useShoal(bait);
  const [, ...segments] = where.split('/');
  const nest = agent ? `${agent}/${graph}` : null;
  const id = udToDec(segments[0]);

  if (agent === 'heap') {
    return (
      <CurioReference
        idCurio={id}
        nest={`heap/${graph}`}
        contextApp={contextApp}
        isScrolling={isScrolling}
      >
        {children}
      </CurioReference>
    );
  }

  if (nest && agent === 'chat') {
    return (
      <WritBaitReference
        chFlag={graph}
        nest={nest}
        index={where}
        contextApp={contextApp}
        isScrolling={isScrolling}
      />
    );
  }

  if (nest && agent === 'diary') {
    return <NoteReference nest={nest} id={id} isScrolling={isScrolling} />;
  }

  return <HeapLoadingBlock reference />;
}

export default React.memo(BaitReference);
