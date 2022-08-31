import React from 'react';
import { useModalNavigate } from '@/logic/routing';
import { useLocation } from 'react-router';
import { isValidPatp } from 'urbit-ob';
import ShipName from '@/components/ShipName';
// eslint-disable-next-line import/no-cycle
import WritReference from '@/chat/ChatContent/ChatContentReference/WritReference';
import CurioReference from '@/chat/ChatContent/ChatContentReference/CurioReference';
import { whomIsFlag } from '@/logic/utils';
import GroupReference from './GroupReference';
import NoteReference from './NoteReference';

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
          const containsDiary = refTokenSplitByFas[3] === 'diary';

          if (containsMessage) {
            const chFlag = refTokenSplitByFas.slice(4, 6).join('/');
            const groupFlag = refTokenSplitByFas.slice(0, 2).join('/');
            const nest = refTokenSplitByFas.slice(3, 6).join('/');
            const idWrit = refTokenSplitByFas.slice(7).join('/');
            return (
              <span key={i}>
                {makeSpace}
                <WritReference
                  chFlag={chFlag}
                  groupFlag={groupFlag}
                  nest={nest}
                  idWrit={idWrit}
                  refToken={x}
                />
              </span>
            );
          }

          if (containsHeap) {
            const chFlag = refTokenSplitByFas.slice(4, 6).join('/');
            const groupFlag = refTokenSplitByFas.slice(0, 2).join('/');
            const nest = refTokenSplitByFas.slice(3, 6).join('/');
            const idCurio = refTokenSplitByFas[7];

            return (
              <span key={i}>
                {makeSpace}
                <CurioReference
                  groupFlag={groupFlag}
                  chFlag={chFlag}
                  nest={nest}
                  idCurio={idCurio}
                  refToken={x}
                />
              </span>
            );
          }

          if (containsDiary) {
            const chFlag = refTokenSplitByFas.slice(4, 6).join('/');
            const groupFlag = refTokenSplitByFas.slice(0, 2).join('/');
            const nest = refTokenSplitByFas.slice(3, 6).join('/');
            const id = refTokenSplitByFas[7];

            return (
              <span key={i}>
                {makeSpace}
                <NoteReference
                  groupFlag={groupFlag}
                  chFlag={chFlag}
                  nest={nest}
                  id={id}
                  refToken={x}
                />
              </span>
            );
          }

          if (isPatp) {
            const handleProfileClick = () => {
              modalNavigate(`/profile/${x}`, {
                state: { backgroundLocation: location },
              });
            };
            return (
              <span key={i}>
                {makeSpace}
                <span
                  className="cursor-pointer font-semibold"
                  onClick={handleProfileClick}
                >
                  <ShipName name={x} />
                </span>
              </span>
            );
          }

          if (whomIsFlag(x)) {
            const groupFlag = refTokenSplitByFas.slice(0, 2).join('/');
            return <GroupReference key={i} flag={groupFlag} />;
          }
        }

        return (
          <span key={i}>
            {makeSpace} {x}
          </span>
        );
      })}
    </>
  );
}
