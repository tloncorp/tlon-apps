import React from 'react';
import ShipImage from './ShipImage';

interface AuthorProps {
  ship: string;
}
export default function Author(props: AuthorProps) {
  const { ship } = props;
  return (
    <div className="flex items-center space-x-3 text-mono text-md align-center">
      <ShipImage ship={ship} />
      <span className="font-bold">{ship}</span>
    </div>
  );
}
