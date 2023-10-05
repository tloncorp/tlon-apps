import ChatSearch, { ChatSearchProps } from '@/chat/ChatSearch/ChatSearch';
import { useChatSearch } from '@/state/chat';
import { useParams } from 'react-router';

export default function DmSearch(
  props: Omit<ChatSearchProps, 'scan' | 'query' | 'isLoading'>
) {
  const { query } = useParams<{ query: string }>();
  const { scan, isLoading } = useChatSearch(props.whom, query || '');
  return (
    <ChatSearch {...props} query={query} scan={scan} isLoading={isLoading}>
      {props.children}
    </ChatSearch>
  );
}
