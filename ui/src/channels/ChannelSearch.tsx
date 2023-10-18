import { useParams } from 'react-router';
import ChatSearch, { ChatSearchProps } from '@/chat/ChatSearch/ChatSearch';
import { useChannelSearch } from '@/state/channel/channel';

export default function ChannelSearch(
  props: Omit<ChatSearchProps, 'scan' | 'query' | 'isLoading'>
) {
  const { query } = useParams<{ query: string }>();
  const { scan, isLoading } = useChannelSearch(props.whom, query || '');
  return (
    <ChatSearch {...props} query={query} scan={scan} isLoading={isLoading}>
      {props.children}
    </ChatSearch>
  );
}
