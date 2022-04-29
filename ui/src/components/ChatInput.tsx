import React, { ChangeEvent, useCallback, useState } from 'react';
import { useChatState } from '../state/chat';
import { ChatMemo } from '../types/chat';

interface ChatInputProps {
  flag: string;
}

export default function ChatInput(props: ChatInputProps) {
  const { flag } = props;
  const [value, setValue] = useState<string>('');

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  const onSubmit = useCallback(() => {
    const memo: ChatMemo = {
      replying: null,
      author: `~${window.ship}`,
      sent: Date.now(),
      content: { inline: [value], block: [] },
    };
    useChatState.getState().sendMessage(flag, memo);
    setValue('');
  }, [value, flag]);

  return (
    <div className="flex space-x-2">
      <input
        className="border rounded grow"
        type="text"
        value={value}
        onChange={onChange}
      />
      <button className="px-2 border rounded" type="button" onClick={onSubmit}>
        Submit!
      </button>
    </div>
  );
}
