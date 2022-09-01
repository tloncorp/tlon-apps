import React, { useEffect } from 'react';
import { useCurio, useHeapState } from '@/state/heap/heap';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import HeapBlock from '@/heap/HeapBlock';
import ReferenceBottomBar from './ReferenceBottomBar';

export default function CurioReference({
  groupFlag,
  chFlag,
  nest,
  idCurio,
  refToken,
}: {
  groupFlag: string;
  chFlag: string;
  nest: string;
  idCurio: string;
  refToken: string;
}) {
  const curioObject = useCurio(chFlag, idCurio);

  useEffect(() => {
    useHeapState.getState().initialize(chFlag);
  }, [chFlag]);

  if (!curioObject) {
    return <HeapLoadingBlock reference />;
  }

  const [time, curio] = curioObject;
  return (
    <div className="heap-inline-block group">
      <HeapBlock curio={curio} time={idCurio} refToken={refToken} />
      <ReferenceBottomBar
        groupFlag={groupFlag}
        nest={nest}
        time={time}
        author={curio.heart.author}
      />
    </div>
  );
}
