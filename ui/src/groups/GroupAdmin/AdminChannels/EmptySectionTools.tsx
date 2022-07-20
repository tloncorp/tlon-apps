import React, { useState } from 'react';
import EditChannelModal from './EditChannelModal';

interface EmptySectionToolsProps {
  sectionKey: string;
}

export default function EmptySectionTools({
  sectionKey,
}: EmptySectionToolsProps) {
  const [newChannelIsOpen, setNewChannelIsOpen] = useState(false);
  return (
    <>
      <div className="flex items-center py-4 px-5">
        <button
          onClick={() => setNewChannelIsOpen(!newChannelIsOpen)}
          className="small-button"
        >
          New Channel
        </button>
        <h2 className="ml-2 font-semibold text-gray-600">
          or Drag A Channel Here
        </h2>
      </div>
      <EditChannelModal
        editIsOpen={newChannelIsOpen}
        setEditIsOpen={setNewChannelIsOpen}
        presetSection={sectionKey}
      />
    </>
  );
}
