import { Fact, Subscription as SubscriptionType } from '@/state/eyre';
import * as Accordion from '@radix-ui/react-accordion';
import cn from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

interface SubscriptionProps {
  sub: SubscriptionType;
  facts: Fact[];
}

export default function Subscription({ sub, facts }: SubscriptionProps) {
  const firstMount = useRef(true);
  const [recentlyReceived, setRecentlyReceived] = useState(false);

  useEffect(() => {
    if (firstMount.current) {
      return;
    }

    const sortedFacts = facts.sort((a, b) => b.time - a.time);
    const head = sortedFacts[0] || { time: 0 };

    if (Math.abs(Date.now() - head.time) <= 150) {
      setRecentlyReceived(true);
      setTimeout(() => setRecentlyReceived(false), 100);
    }
  }, [facts]);

  useEffect(() => {
    firstMount.current = false;
  }, []);

  return (
    <Accordion.Item value={sub.id.toString()}>
      <Accordion.Header>
        <Accordion.Trigger
          className={cn(
            'flex w-full items-center space-x-3 rounded-md p-2 font-mono',
            firstMount.current
              ? 'bg-gray-200'
              : recentlyReceived
                ? 'bg-pink-400'
                : 'pulseOut'
          )}
        >
          <span>{sub.id}</span>
          <strong className="font-sans">{sub.app}</strong>
          <span>{sub.path}</span>
          <span className="flex-1 text-right">{facts.length}</span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="space-y-2 py-2">
        <h2 className="font-semibold">fact log:</h2>
        <div className="h-[200px] w-full overflow-scroll whitespace-nowrap rounded-md bg-gray-100 font-mono">
          {facts.map((f, i) => (
            <div key={f.time} className="flex items-center space-x-4 px-2 py-1">
              <div className="w-8 flex-none text-right">{f.id}</div>
              <div className="w-28 flex-none">
                {new Date(f.time).toLocaleTimeString()}
              </div>
              <div className="flex-1">{JSON.stringify(f.data)}</div>
            </div>
          ))}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
