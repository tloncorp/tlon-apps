import React, { useCallback, useEffect } from 'react';
import { useModalNavigate } from '@/logic/routing';
import { useLocation, useNavigate } from 'react-router';
import { useCurio, useHeapState } from '@/state/heap/heap';
import { isValidPatp } from 'urbit-ob';
import HeapBlock from '@/heap/HeapBlock';
import ShipName from '@/components/ShipName';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { useWrit } from '@/state/chat';
// eslint-disable-next-line import/no-cycle
import ChatMessage from '@/chat/ChatMessage/ChatMessage';

function CurioReference({
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

function WritReference({
  chFlag,
  idWrit,
  refToken,
}: {
  chFlag: string;
  idWrit: string;
  refToken: string;
}) {
  const writObject = useWrit(chFlag, idWrit);
  const navigate = useNavigate();

  const onClick = useCallback(() => {
    navigate(`/groups/${refToken}`);
  }, [navigate, refToken]);

  if (!writObject) {
    return (
      <div className="writ-inline-block p-2">
        This is a reference to a group you do not have access to.
      </div>
    );
  }

  const [time, writ] = writObject;
  return (
    <div onClick={onClick} className="writ-inline-block p-2">
      <ChatMessage
        whom={chFlag}
        time={time}
        writ={writ}
        newAuthor
        hideReplies
        hideOptions
      />
    </div>
  );
}

export default function ChatContentReference({ story }: { story: string }) {
  const modalNavigate = useModalNavigate();
  const location = useLocation();
  const storySplitBySpace = story.split(' ');

  return (
    <>
      {storySplitBySpace.map((x, i) => {
        const makeSpace = i === 0 ? '' : ' ';

        if (x.startsWith('~')) {
          const refTokenSplitByFas = x.split('/');
          const isPatp = refTokenSplitByFas.length === 1 && isValidPatp(x);
          const containsHeap = refTokenSplitByFas[3] === 'heap';
          const containsMessage = refTokenSplitByFas[6] === 'message';

          if (containsMessage) {
            const chFlag = refTokenSplitByFas.slice(4, 6).join('/');
            const idWrit = refTokenSplitByFas.slice(7).join('/');
            return (
              <>
                {makeSpace}
                <WritReference chFlag={chFlag} idWrit={idWrit} refToken={x} />
              </>
            );
          }

          if (containsHeap) {
            const chFlag = refTokenSplitByFas.slice(4, 6).join('/');
            const idCurio = refTokenSplitByFas[7];

            return (
              <>
                {makeSpace}
                <CurioReference
                  chFlag={chFlag}
                  idCurio={idCurio}
                  refToken={x}
                />
              </>
            );
          }

          if (isPatp) {
            const handleProfileClick = () => {
              modalNavigate(`/profile/${x}`, {
                state: { backgroundLocation: location },
              });
            };
            return (
              <>
                {makeSpace}
                <span
                  className="cursor-pointer font-semibold"
                  onClick={handleProfileClick}
                >
                  <ShipName name={x} />
                </span>
              </>
            );
          }
        }
        return (
          <>
            {makeSpace} {x}
          </>
        );
      })}
    </>
  );
}
