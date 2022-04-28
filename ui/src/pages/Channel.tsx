import React from 'react';
import { useParams } from 'react-router';
import ChatWindow from '../components/ChatWindow';
import { useChatIsJoined, useChatState } from '../state/chat';

function Channel() {
  const { chShip, chName, app } = useParams();
  const flag = `${chShip}/${chName}`;
  const isJoined = useChatIsJoined(flag);
  const join = () => {
    useChatState.getState().joinChat(flag);
  };
  return isJoined ? (
    <ChatWindow flag={flag} />
  ) : (
    <div>
      <h1>{flag}</h1>
      <button onClick={join}>Join</button>
    </div>
  );
}

export default Channel;
