import React from 'react';
import { BigIntOrderedMap } from '@urbit/api';
import bigInt from 'big-integer';
import SelectOptionScroller from './SelectOptionScroller';
import { ISelectOptionScroller } from './ISelectOptionScroller';

// options is a list of JSX nodes to render in the VScroller
const optionsToGraph = (options: React.ReactNode[]) => {
  let graph = new BigIntOrderedMap<React.ReactNode>();

  if (options.length === 0) {
    return graph;
  }

  options.forEach((o, i) => {
    graph = graph.set(bigInt(i), o);
  });

  return graph;
};

export default function ShipOptionScroller({
  options,
  renderer,
}: ISelectOptionScroller) {
  const optionsGraph = optionsToGraph(options);

  return (
    <div className="relative h-full flex-1">
      {optionsGraph.size > 0 ? (
        <SelectOptionScroller
          origin="top"
          data={optionsGraph}
          size={optionsGraph.size}
          pendingSize={0} // TODO
          averageHeight={40}
          renderer={renderer}
          loadRows={() => Promise.resolve(true)}
        />
      ) : null}
    </div>
  );
}
