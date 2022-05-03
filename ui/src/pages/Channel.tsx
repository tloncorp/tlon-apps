import _ from 'lodash';
import React from 'react';
import { useParams } from 'react-router';
import ChatInput from '../components/ChatInput/ChatInput';
import ChatWindow from '../components/ChatWindow';
import { useChatIsJoined, useChatPerms, useChatState } from '../state/chat';
import { useRouteGroup, useVessel } from '../state/groups';

function Channel() {
  const { chShip, chName } = useParams();
  const flag = `${chShip}/${chName}`;
  const groupFlag = useRouteGroup();
  const perms = useChatPerms(flag);
  const vessel = useVessel(groupFlag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;
  const isJoined = useChatIsJoined(flag);
  const join = () => {
    useChatState.getState().joinChat(flag);
  };
  return isJoined ? (
    <div className="flex flex-col grow">
      <ChatWindow flag={flag} />
      {canWrite ? (
        <div className="p-4">
          <ChatInput flag={flag} />
        </div>
      ) : null}
    </div>
  ) : (
    <div>
      <h1>{flag}</h1>
      <button onClick={join}>Join</button>
    </div>
  );
}

export default Channel;
