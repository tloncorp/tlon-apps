import { useParams } from 'react-router';
import ChatSearch, { ChatSearchProps } from '@/chat/ChatSearch/ChatSearch';
import { useChannelSearch } from '@/state/channel/channel';

export default function ChannelSearch(
  props: Omit<ChatSearchProps, 'scan' | 'query' | 'isLoading' | 'endReached'>
) {
  const { query } = useParams<{ query: string }>();
  // TODO: convert channel search to infinite query like DMs
  const { scan, isLoading } = useChannelSearch(props.whom, query || '');
  return (
    <ChatSearch {...props} query={query} scan={scan} isLoading={isLoading}>
      {props.children}
    </ChatSearch>
  );
}
