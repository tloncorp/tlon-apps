import React, { useEffect, useState } from 'react';
import { useCurio, useHeapState } from '@/state/heap/heap';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import HeapBlock from '@/heap/HeapBlock';
import { useGroupPreviewByNest } from '@/state/groups';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import ReferenceBar from './ReferenceBar';

export default function CurioReference({
  chFlag,
  nest,
  idCurio,
}: {
  chFlag: string;
  nest: string;
  idCurio: string;
}) {
  const curioObject = useCurio(chFlag, idCurio);
  const preview = useGroupPreviewByNest(nest);
  const [scryError, setScryError] = useState<string>();
  const refToken = preview?.group
    ? `${preview.group.flag}/channels/${nest}/curio/${idCurio}`
    : undefined;

  useEffect(() => {
    useHeapState
      .getState()
      .initialize(chFlag)
      .catch((reason) => {
        setScryError(reason);
      });
  }, [chFlag]);

  if (scryError !== undefined) {
    // TODO handle requests for single curios like we do for single writs.
    const time = bigInt(udToDec(idCurio));
    return (
      <div className="heap-inline-block group">
        This content is unavailable to you.
        <ReferenceBar
          nest={nest}
          time={time}
          groupFlag={preview?.group.flag}
          groupTitle={preview?.group.meta.title}
          channelTitle={preview?.meta?.title}
        />
      </div>
    );
  }

  if (!curioObject) {
    return <HeapLoadingBlock reference />;
  }

  const [time, curio] = curioObject;
  if (!curio) {
    return <HeapLoadingBlock reference />;
  }
  return (
    <div className="heap-inline-block group">
      <HeapBlock curio={curio} time={idCurio} refToken={refToken} />
      <ReferenceBar
        nest={nest}
        time={time}
        author={curio.heart.author}
        groupFlag={preview?.group.flag}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
      />
    </div>
  );
}
