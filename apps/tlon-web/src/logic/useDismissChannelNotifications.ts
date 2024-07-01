import { useEffect } from 'react';

interface UseDismissChannelProps {
  nest: string;
  markRead: () => Promise<void>;
  isMarking: boolean;
}

export default function useDismissChannelNotifications({
  markRead,
  isMarking,
}: UseDismissChannelProps) {
  useEffect(() => {
    if (!isMarking) {
      // dismiss unread
      markRead();
    }
  }, [markRead, isMarking]);
}
