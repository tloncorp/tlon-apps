import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import ob from 'urbit-ob';
import ChatInput from '../chat/ChatInput/ChatInput';
import Layout from '../components/Layout/Layout';
import DMInviteInput, { Option } from '../dms/DMInviteInput';

export default function NewDM() {
  const [ship, setShip] = useState<Option | undefined>();
  const navigate = useNavigate();
  const validShip = ship ? ob.isValidPatp(ship.value) : false;

  return (
    <Layout
      className="flex-1"
      footer={
        <div className="border-t-2 border-black/10 p-4">
          <ChatInput
            whom={ship ? ship.value : ''}
            showReply
            sendDisabled={!validShip}
            newDm
            navigate={navigate}
          />
        </div>
      }
    >
      <div className="w-full py-3 px-4">
        <DMInviteInput ship={ship} setShip={setShip} />
      </div>
    </Layout>
  );
}
