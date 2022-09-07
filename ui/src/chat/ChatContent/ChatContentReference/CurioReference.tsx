import React, { useEffect } from 'react';
import { useCurio, useHeapState } from '@/state/heap/heap';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import HeapBlock from '@/heap/HeapBlock';
import ReferenceBar from '@/chat/ChatContent/ChatContentReference/ReferenceBar';
import {useGroupPreviewByNest} from '@/state/groups';

export default function CurioReference({
  chFlag,
  nest,
  idCurio,
}: {
  groupFlag: string;
  chFlag: string;
  nest: string;
  idCurio: string;
}) {
  const curioObject = useCurio(chFlag, idCurio);
  const preview = useGroupPreviewByNest(nest)

  useEffect(() => {
    useHeapState.getState().initialize(chFlag);
  }, [chFlag]);

  if (!curioObject) {
    return <HeapLoadingBlock reference />;
  }

  const [time, curio] = curioObject;
  if (!curio) {
    return <HeapLoadingBlock reference />;
  }
  return (
    <div className="heap-inline-block group">
      <HeapBlock curio={curio} time={idCurio} />
      <ReferenceBar
        nest={nest}
        time={time}
        author={curio.heart.author}
      />
    </div>
  );
}
