import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import { useCallback } from 'react';
import { MemoryRouter } from 'react-router';

export default function MessageEditorFixture() {
  const messageEditor = useMessageEditor({
    whom: window.ship,
    content: '',
    uploadKey: 'test',
    placeholder: 'Message',
    allowMentions: true,
    onEnter: useCallback(() => false, []),
    onUpdate: useCallback(() => null, []),
  });

  return messageEditor ? (
    <MemoryRouter>
      <MessageEditor editor={messageEditor} />
    </MemoryRouter>
  ) : null;
}
