import React from 'react';
import { BigIntOrderedMap } from '@urbit/api';
import bigInt from 'big-integer';
import { ISelectOptionScroller } from './ISelectOptionScroller';
import NodeScroller from './NodeScroller';

// nodes is a list of JSX nodes to render in the VScroller
const nodesToGraph = (nodes: React.ReactNode[]) => {
  let graph = new BigIntOrderedMap<React.ReactNode>();

  if (nodes.length === 0) {
    return graph;
  }

  nodes.forEach((o, i) => {
    graph = graph.set(bigInt(i), o);
  });

  return graph;
};

export default function ShipOptionScroller({
  options,
  renderer,
}: ISelectOptionScroller) {
  const optionsGraph = nodesToGraph(options);

  return (
    <div className="relative h-full flex-1">
      {optionsGraph.size > 0 ? (
        <NodeScroller
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
