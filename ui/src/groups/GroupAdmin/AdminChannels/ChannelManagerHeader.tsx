import React, { useState } from 'react';
import EditChannelModal from './EditChannelModal';

interface ChannelManagerHeaderProps {
  addSection: () => void;
}

export default function ChannelManagerHeader({
  addSection,
}: ChannelManagerHeaderProps) {
  const [newChannelIsOpen, setNewChannelIsOpen] = useState(false);
  return (
    <>
      <div className="my-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Channels</h2>
        <div>
          <button
            className="small-secondary-button mx-2 bg-blend-multiply"
            onClick={() => addSection()}
          >
            New Section
          </button>
          <button
            onClick={() => setNewChannelIsOpen(true)}
            className="small-button"
          >
            New Channel
          </button>
        </div>
      </div>
      <EditChannelModal
        editIsOpen={newChannelIsOpen}
        setEditIsOpen={setNewChannelIsOpen}
      />
    </>
  );
}
