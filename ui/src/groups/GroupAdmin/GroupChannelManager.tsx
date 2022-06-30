import React from 'react';
import AdminChannelList from './AdminChannelList';

export default function GroupChannelManager() {
  return (
    <>
      <div className="card">
        <h1 className="mb-2 text-lg font-semibold">Channel Settings</h1>
        <p className="max-w-prose">
          Modify how channels will be presented to your members. Ordering of
          sections and channels will be reflected in the Default View.
        </p>
      </div>
      <AdminChannelList />
    </>
  );
}
