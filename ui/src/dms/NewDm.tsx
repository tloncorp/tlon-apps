import _ from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import ShipSelector from '@/components/ShipSelector';
import useMessageSelector from '@/logic/useMessageSelector';

export default function NewDM() {
  const { onEnter, sendDm, setShips, ships, validShips, whom } =
    useMessageSelector();

  return (
    <Layout
      className="flex-1"
      footer={
        <div className="border-t-2 border-gray-50 p-4">
          <ChatInput
            whom={whom}
            showReply
            sendDisabled={!validShips()}
            sendMessage={sendDm}
          />
        </div>
      }
    >
      <div className="flex w-full items-center space-x-2 py-3 px-4">
        <div className="w-full">
          <ShipSelector
            ships={ships}
            setShips={setShips}
            onEnter={onEnter}
            isMulti={true}
          />
        </div>
        <Link className="secondary-button py-2.5" to="/">
          Cancel
        </Link>
      </div>
    </Layout>
  );
}
