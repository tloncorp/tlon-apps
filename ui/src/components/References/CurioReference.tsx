import React, { useEffect, useState } from 'react';
import { useHeapState, useRemoteCurio } from '@/state/heap/heap';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
// eslint-disable-next-line import/no-cycle
import HeapBlock from '@/heap/HeapBlock';
import { useChannelPreview, useGang } from '@/state/groups';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import useGroupJoin from '@/groups/useGroupJoin';
import { useLocation, useNavigate } from 'react-router';
import useNavigateByApp from '@/logic/useNavigateByApp';
import ReferenceBar from './ReferenceBar';
import UnavailableReference from './UnavailableReference';

export default function CurioReference({
  chFlag,
  nest,
  idCurio,
  isScrolling = false,
}: {
  chFlag: string;
  nest: string;
  idCurio: string;
  isScrolling?: boolean;
}) {
  const curio = useRemoteCurio(chFlag, idCurio, isScrolling);
  const preview = useChannelPreview(nest, isScrolling);
  const location = useLocation();
  const navigate = useNavigate();
  const navigateByApp = useNavigateByApp();
  const groupFlag = preview?.group?.flag || '~zod/test';
  const gang = useGang(groupFlag);
  const { group } = useGroupJoin(groupFlag, gang);
  const [scryError, setScryError] = useState<string>();
  const refToken = preview?.group
    ? `${preview.group.flag}/channels/${nest}/curio/${idCurio}`
    : undefined;

  const handleOpenReferenceClick = () => {
    if (!group) {
      navigate(`/gangs/${groupFlag}?type=curio&nest=${nest}&id=${idCurio}`, {
        state: { backgroundLocation: location },
      });
      return;
    }
    navigateByApp(`/groups/${groupFlag}/channels/${nest}/curio/${idCurio}`);
  };

  useEffect(() => {
    if (!isScrolling) {
      useHeapState
        .getState()
        .initialize(chFlag)
        .catch((reason) => {
          console.log(reason);
        });
    }
  }, [chFlag, isScrolling]);

  if (scryError !== undefined) {
    // TODO handle requests for single curios like we do for single writs.
    const time = bigInt(udToDec(idCurio));
    return <UnavailableReference time={time} nest={nest} preview={preview} />;
  }

  if (!curio) {
    return <HeapLoadingBlock reference />;
  }
  return (
    <div className="heap-inline-block not-prose group">
      <div
        onClick={handleOpenReferenceClick}
        className="flex h-full cursor-pointer flex-col justify-between p-2"
      >
        <HeapBlock curio={curio} time={idCurio} refToken={refToken} asRef />
      </div>
      <ReferenceBar
        nest={nest}
        time={bigInt(idCurio)}
        author={curio.heart.author}
        groupFlag={preview?.group.flag}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
      />
    </div>
  );
}
