import React from 'react';
import { useParams } from 'react-router';
import ChatInput from '../components/ChatInput/ChatInput';
import Layout from '../components/layout/Layout';

export default function Dm() {
  const ship = useParams().ship!;

  return (
    <Layout
      className="h-full grow"
      header={<div className="border-b p-2 font-bold">{ship}</div>}
      main={<div className="flex">Message </div>}
      footer={
        <div className="p-2">
          <ChatInput flag="~zod/test" />
        </div>
      }
    />
  );
}
