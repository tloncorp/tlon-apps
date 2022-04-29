import React from 'react';
import Chat from './views/Chat';

export default function App() {
  // TODO: as we add views, can route like so:

  // <Routes>
  //   <Route path="/chat/*" element={<Chat />} />
  //   <Route path="/settings/*" element={<Settings />} />
  //   <Route path="*" element={<Navigate to={'/chat'} />} />
  // </Routes>

  return <Chat />;
}
