import cn from 'classnames';
import { Editor } from '@tiptap/react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Inline } from '@/types/content';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { useIsMobile } from '@/logic/useMedia';
import { useAddReplyMutation, useReply } from '@/state/channel/channel';
import useRequestState from '@/logic/useRequestState';
import { normalizeInline, JSONToInlines, makeMention } from '@/logic/tiptap';
import X16Icon from '@/components/icons/X16Icon';
import { pathToCite } from '@/logic/utils';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import { useChannelCompatibility } from '@/logic/channel';
import Tooltip from '@/components/Tooltip';
import { Story, Cite, Kind } from '@/types/channel';
import WritChanReference from '@/components/References/WritChanReference';

interface DiaryCommentFieldProps {
  flag: string;
  han: Kind;
  groupFlag: string;
  replyTo: string;
  className?: string;
  sendDisabled?: boolean;
}

export default function DiaryCommentField({
  flag,
  han,
  groupFlag,
  replyTo,
  className,
  sendDisabled = false,
}: DiaryCommentFieldProps) {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParms] = useSearchParams();
  const [replyCite, setReplyCite] = useState<{ cite: Cite }>();
  const replyId = searchParams.get('reply');
  const nest = `${han}/${flag}`;
  const reply = useReply(nest, replyTo, replyId || '');
  const { isPending, setPending, setReady } = useRequestState();
  const { mutateAsync: addReply } = useAddReplyMutation();
  const { privacy } = useGroupPrivacy(groupFlag);
  const { compatible, text } = useChannelCompatibility(nest);

  /**
   * This handles submission for new Curios; for edits, see EditCurioForm
   */
  const onSubmit = useCallback(
    async (editor: Editor) => {
      if (sendDisabled) {
        return;
      }
      if (!editor.getText() && !replyCite) {
        return;
      }

      setPending();

      const inline = normalizeInline(
        JSONToInlines(editor?.getJSON()) as Inline[]
      );

      editor?.commands.setContent('');

      let content: Story = [{ inline }];

      if (replyCite) {
        content = [
          {
            block: replyCite,
          },
          ...content,
        ];
      }

      await addReply({
        nest,
        postId: replyTo,
        content,
      });
      captureGroupsAnalyticsEvent({
        name: 'comment_item',
        groupFlag,
        chFlag: flag,
        channelType: 'diary',
        privacy,
      });
      setReplyCite(undefined);
      setSearchParms();
      setReady();
    },
    [
      sendDisabled,
      setPending,
      replyTo,
      flag,
      nest,
      groupFlag,
      privacy,
      setReady,
      replyCite,
      setReplyCite,
      setSearchParms,
      addReply,
    ]
  );

  const clearAttachments = () => {
    setReplyCite(undefined);
    setSearchParms();
  };

  const messageEditor = useMessageEditor({
    whom: replyTo,
    content: '',
    uploadKey: `diary-comment-field-${flag}`,
    placeholder: 'Add a comment',
    editorClass: 'p-0 !min-h-[72px]',
    allowMentions: true,
    onEnter: useCallback(
      ({ editor }) => {
        onSubmit(editor);
        return true;
      },
      [onSubmit]
    ),
  });

  useEffect(() => {
    if (flag && messageEditor && !messageEditor.isDestroyed) {
      messageEditor?.commands.setContent('');
    }
  }, [flag, messageEditor]);

  useEffect(() => {
    if (reply && replyId && messageEditor && !messageEditor.isDestroyed) {
      messageEditor?.commands.focus();
      const mention = makeMention(reply?.memo.author.slice(1));
      messageEditor?.commands.setContent(mention);
      messageEditor?.commands.insertContent(': ');
      const path = `/1/chan/diary/${flag}/note/${replyTo}/msg/${replyId}`;
      const cite = path ? pathToCite(path) : undefined;
      if (cite && !replyCite) {
        setReplyCite({ cite });
      }
    }
  }, [replyId, replyTo, setReplyCite, replyCite, flag, messageEditor, reply]);

  const onClick = useCallback(
    () => messageEditor && onSubmit(messageEditor),
    [messageEditor, onSubmit]
  );

  if (!messageEditor) {
    return null;
  }

  // TODO: Set a sane length limit for comments
  return (
    <>
      <div className={cn('flex flex-col items-end', className)}>
        {replyCite && (
          <div className="mb-2 flex w-full flex-col items-center">
            <div className="mb-4 flex w-full items-center justify-between font-semibold">
              <span className="mr-2 text-gray-600">Replying to:</span>
              <button
                className="icon-button ml-auto"
                onClick={clearAttachments}
              >
                <X16Icon className="h-4 w-4" />
              </button>
            </div>
            <WritChanReference
              nest={nest}
              idWrit={replyTo}
              idReply={replyId || ''}
              isScrolling={false}
            />
          </div>
        )}
        <MessageEditor
          editor={messageEditor}
          className="h-full w-full rounded-lg"
          inputClassName={cn(
            'p-4 leading-5',
            // Since TipTap simulates an input using a <p> tag, only style
            // the fake placeholder when the field is empty
            messageEditor.getText() === '' ? 'text-gray-400' : ''
          )}
        />
        {!sendDisabled ? (
          <Tooltip content={text} open={compatible ? false : undefined}>
            <button
              className="button mt-2"
              disabled={
                !compatible ||
                isPending ||
                (messageEditor.getText() === '' && !replyCite)
              }
              onClick={onClick}
            >
              {isPending ? 'Posting...' : 'Post'}
            </button>
          </Tooltip>
        ) : null}
      </div>
      {isMobile && messageEditor.isFocused ? (
        <ChatInputMenu editor={messageEditor} />
      ) : null}
    </>
  );
}
