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
        className="grow rounded border"
        type="text"
        value={value}
        onChange={onChange}
      />
      <button className="rounded border px-2" type="button" onClick={onSubmit}>
        Submit!
      </button>
    </div>
  );
}
