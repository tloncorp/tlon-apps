import * as Accordion from '@radix-ui/react-accordion';
import cn from 'classnames';
import React from 'react';

import { Fact, useEyreState } from '@/state/eyre';

import Subscription from './Subscription';

function filterFacts(facts: Fact[], id: number) {
  return facts.filter((f) => {
    try {
      const data = JSON.parse(f.data);

      if ('id' in data) {
        return data.id === id;
      }

      return false;
    } catch (error) {
      return false;
    }
  });
}

export default function Eyrie() {
  const { channel, status, idStatus, facts, subscriptions, errors, onReset } =
    useEyreState();

  return (
    <div className="flex h-full w-full flex-col space-y-6 rounded-3xl bg-gray-50 p-6">
      <div className="flex items-center justify-between space-x-6">
        <button onClick={onReset} className="button bg-orange-300">
          reset
        </button>
        <div className="flex items-center space-x-2">
          <strong>channel:</strong>
          <span>{channel}</span>
        </div>
      </div>
      <h2
        className={cn(
          'flex items-center justify-center rounded-md p-4 font-bold',
          {
            'bg-red-400': status === 'errored',
            'bg-green-400': status === 'active',
            'bg-teal-400': status === 'reconnected',
            'bg-yellow-400': status === 'reconnecting',
            'bg-blue-400': status === 'opening',
            'bg-gray-200': status === 'initial',
          }
        )}
      >
        {status}
      </h2>
      <div className="flex flex-wrap justify-between">
        <div className="space-x-2">
          <strong>last sent id:</strong>
          <span>{idStatus.current}</span>
        </div>
        <div className="space-x-2">
          <strong>last heard id:</strong>
          <span>{idStatus.lastHeard}</span>
        </div>
        <div className="space-x-2">
          <strong>last ackd id:</strong>
          <span>{idStatus.lastAcknowledged}</span>
        </div>
      </div>
      <hr />
      <Accordion.Root type="multiple" className="space-y-2">
        <Accordion.Item value="error">
          <Accordion.Header>
            <Accordion.Trigger className="flex w-full items-center justify-between space-x-3 rounded-md bg-gray-200 p-2">
              <strong>error log</strong>
              <span>{errors.length}</span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="py-2">
            <div className="max-h-96 min-h-[48px] overflow-scroll whitespace-nowrap rounded-md bg-gray-100 font-mono">
              {errors.map((e, i) => (
                <div
                  key={e.time}
                  className="flex items-center space-x-2 px-2 py-1"
                >
                  <div>{new Date(e.time).toLocaleTimeString()}</div>
                  <div>{e.msg}</div>
                </div>
              ))}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
      <div className="max-h-96 overflow-y-auto">
        <Accordion.Root type="multiple" className="space-y-2">
          {Object.values(subscriptions).map((sub) => (
            <Subscription
              key={sub.id}
              sub={sub}
              facts={filterFacts(facts, sub.id)}
            />
          ))}
        </Accordion.Root>
      </div>
    </div>
  );
}
