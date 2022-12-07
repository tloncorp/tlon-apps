import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { useHasMigratedChannels } from '@/logic/useMigrationInfo';
import { useGroup, useShoal } from '@/state/groups';
import { BaitCite } from '@/types/chat';
import { udToDec } from '@urbit/api';
import cn from 'classnames';
import React from 'react';
import ExclamationPoint from '../icons/ExclamationPoint';
// eslint-disable-next-line import/no-cycle
import CurioReference from './CurioReference';
import NoteReference from './NoteReference';

// eslint-disable-next-line import/no-cycle
import WritBaitReference from './WritBaitReference';

export default function BaitReference({
  bait,
  isScrolling,
}: {
  isScrolling: boolean;
  bait: BaitCite['bait'];
}) {
  const { group, graph, where } = bait;
  const theGroup = useGroup(group);
  const groupTitle = theGroup?.meta.title;
  const agent = useShoal(bait);
  const [, ...segments] = where.split('/');
  const nest = agent ? `${agent}/${graph}` : null;
  const id = udToDec(segments[0]);
  const hasMigrated = useHasMigratedChannels(bait.group);

  if (!hasMigrated) {
    return (
      <div className="heap-inline-block h-[126px] items-center justify-center bg-gray-100">
        <ExclamationPoint className="h-6 w-6" />
        <span className="ml-2">
          This content belongs to a channel that has not been migrated yet.
        </span>
      </div>
    );
  }

  if (agent === 'heap') {
    return (
      <CurioReference
        idCurio={id}
        chFlag={graph}
        nest={`heap/${graph}`}
        isScrolling={isScrolling}
      />
    );
  }

  if (nest && agent === 'chat') {
    return (
      <WritBaitReference
        chFlag={graph}
        nest={nest}
        index={where}
        isScrolling={isScrolling}
      />
    );
  }

  if (nest && agent === 'diary') {
    return (
      <NoteReference
        chFlag={graph}
        nest={nest}
        id={id}
        isScrolling={isScrolling}
      />
    );
  }

  return <HeapLoadingBlock reference />;
}
