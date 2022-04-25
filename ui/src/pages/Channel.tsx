import React from 'react';
import { useParams } from 'react-router';
import ChatWindow from '../components/ChatWindow';

function Channel() {
  const { chShip, chName, app } = useParams();
  const flag = `${chShip}/${chName}`;
  return <ChatWindow flag={flag} />;
}

export default Channel;
