import React from 'react';
import { useModalNavigate } from '@/logic/routing';
import { useLocation } from 'react-router';
import { isValidPatp } from 'urbit-ob';
import ShipName from '@/components/ShipName';
// eslint-disable-next-line import/no-cycle
import WritReference from '@/chat/ChatContent/ChatContentReference/WritReference';
import CurioReference from '@/chat/ChatContent/ChatContentReference/CurioReference';
import { nestToFlag, whomIsFlag } from '@/logic/utils';
import { Cite } from '@/types/chat';
import { udToDec } from '@urbit/api';
import GroupReference from './GroupReference';

export default function ChatContentReference({ cite }: { cite: Cite }) {
  const modalNavigate = useModalNavigate();
  const location = useLocation();
  if ('group' in cite) {
    return <GroupReference flag={cite.group} />;
  }
  if ('chan' in cite) {
    const { nest, where } = cite.chan;
    const [app, chFlag] = nestToFlag(cite.chan.nest);
    const segments = where.split('/');
    const groupFlag = '~bus/test-group';
    if (app === 'heap') {
      const idCurio = udToDec(segments[2]);
      return (
        <CurioReference
          groupFlag={groupFlag}
          chFlag={chFlag}
          nest={nest}
          idCurio={idCurio}
        />
      );
    }
    if (app === 'chat') {
      const idWrit = udToDec(segments[2]);
      return (
        <WritReference
          chFlag={chFlag}
          groupFlag={groupFlag}
          nest={nest}
          idWrit={idWrit}
          refToken=""
        />
      );
    }
    if (app === 'diary') {
      return null;
    }
  }
  return null;
  /*
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
            const groupFlag = refTokenSplitByFas.slice(0, 2).join('/');
            const nest = refTokenSplitByFas.slice(3, 6).join('/');
            const idWrit = refTokenSplitByFas.slice(7).join('/');
            return (
              <>
                {makeSpace}
                <WritReference
                  chFlag={chFlag}
                  groupFlag={groupFlag}
                  nest={nest}
                  idWrit={idWrit}
                  refToken={x}
                />
              </>
            );
          }

          if (containsHeap) {
            const chFlag = refTokenSplitByFas.slice(4, 6).join('/');
            const groupFlag = refTokenSplitByFas.slice(0, 2).join('/');
            const nest = refTokenSplitByFas.slice(3, 6).join('/');
            const idCurio = refTokenSplitByFas[7];

            return (
              <>
                {makeSpace}
                <CurioReference
                  groupFlag={groupFlag}
                  chFlag={chFlag}
                  nest={nest}
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

          if (whomIsFlag(x)) {
            const groupFlag = refTokenSplitByFas.slice(0, 2).join('/');
            return <GroupReference flag={groupFlag} />;
          }
        }

        return (
          <>
            {makeSpace} {x}
          </>
        );
      })}
    </>
  ); */
}
