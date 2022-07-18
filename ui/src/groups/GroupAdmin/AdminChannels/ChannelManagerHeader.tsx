import React from 'react';

interface ChannelManagerHeaderProps {
  addSection: () => void;
}

export default function ChannelManagerHeader({
  addSection,
}: ChannelManagerHeaderProps) {
  return (
    <div className="my-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold">Channels</h2>
      <div>
        <button className="small-button mx-2" onClick={addSection}>
          New Section
        </button>
        <button className="small-button">New Channel</button>
      </div>
    </div>
  );
}
