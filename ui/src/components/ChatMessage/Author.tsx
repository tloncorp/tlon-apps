import React from 'react';
import ShipImage from './ShipImage';

interface AuthorProps {
  ship: string;
}
export default function Author(props: AuthorProps) {
  const { ship } = props;
  return (
    <div className="text-mono text-md align-center flex items-center space-x-3">
      <ShipImage ship={ship} />
      <span className="font-bold">{ship}</span>
    </div>
  );
}
