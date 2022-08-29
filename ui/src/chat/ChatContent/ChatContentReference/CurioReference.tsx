import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useCurio, useHeapState } from '@/state/heap/heap';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import HeapBlock from '@/heap/HeapBlock';

export default function CurioReference({
  chFlag,
  idCurio,
  refToken,
}: {
  chFlag: string;
  idCurio: string;
  refToken: string;
}) {
  const curioObject = useCurio(chFlag, idCurio);
  const navigate = useNavigate();

  const onClick = useCallback(() => {
    navigate(`/groups/${refToken}`);
  }, [navigate, refToken]);

  useEffect(() => {
    useHeapState.getState().initialize(chFlag);
  }, [chFlag]);

  if (!curioObject) {
    return <HeapLoadingBlock reference />;
  }

  const curio = curioObject[1];
  return (
    <div onClick={onClick}>
      <HeapBlock curio={curio} time={idCurio} reference />
    </div>
  );
}
