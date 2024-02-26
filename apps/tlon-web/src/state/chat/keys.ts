const pending = () => ['dms', 'pending'];
const unreads = () => ['dms', 'unreads'];

const infiniteDmsKey = (whom: string) => ['dms', whom, 'infinite'];

const ChatQueryKeys = {
  pending,
  unreads,
  infiniteDmsKey,
};

export default ChatQueryKeys;
