import {
  EditorOnBlurProps,
  EditorOnUpdateProps,
  inlinesToJSON,
  parseTipTapJSON,
} from '@/logic/tiptap';
import { DiaryInline, NoteContent, Verse, VerseInline } from '@/types/diary';
import { Editor, EditorOptions, KeyboardShortcutCommand } from '@tiptap/react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import DiaryInlineEditor, { useDiaryInlineEditor } from './DiaryInlineEditor';
import { DiaryVerse } from './DiaryVerse';

export interface DiaryEditorProps {
  content: NoteContent;
  setContent: (f: React.SetStateAction<NoteContent>) => void;
}

interface EditorCallbackArgs {
  editor: Editor;
}

export default function DiaryEditor(props: DiaryEditorProps) {
  const { content, setContent } = props;
  const [editing, setEditing] = useState(null as number | null);

  const shouldAppendOnBlur = useRef(false);
  const appendPara = useCallback(() => {
    setContent((cs) => [...cs, { inline: [] }]);
    setEditing(content.length);
  }, [setContent, content]);

  const editorContent = useMemo(() => {
    if (editing === null) {
      return '';
    }
    const target = (content[editing] as VerseInline).inline;
    if (target.length === 0) {
      return '';
    }
    return inlinesToJSON((content[editing] as VerseInline).inline);
  }, [editing, content]);

  const onUpdate = useCallback(({ transaction }: EditorOnUpdateProps) => {
    console.log(transaction);
  }, []);

  const onEnter = useCallback(
    ({ editor }: Parameters<KeyboardShortcutCommand>[0]) => {
      console.log('entered');
      shouldAppendOnBlur.current = true;
      editor.chain().blur().run();
      return true;
    },
    []
  );

  const onBlur = useCallback(
    ({ editor }: EditorOnBlurProps) => {
      if (editor.isDestroyed) {
        console.log('bail');
        return;
      }
      if (editing === null) {
        console.warn(new Error('Invariant violation'));
        return;
      }
      const json = editor.getJSON();
      const inline = parseTipTapJSON(json);
      // autoprune empty fields on blur
      if (editing === content.length - 1 && inline.length === 0) {
        setContent((s) => s.slice(0, editing));
        return;
      }
      const newContent: Verse = { inline };
      const trailing: Verse[] = shouldAppendOnBlur.current
        ? [{ inline: [] }]
        : [];
      if (shouldAppendOnBlur.current) {
        console.log(content);
        setEditing(0);
      }

      shouldAppendOnBlur.current = false;

      setContent((s) => {
        const res = [
          ...s.slice(0, editing),
          newContent,
          ...s.slice(editing + 1),
          ...trailing,
        ];
        console.log(res);
        return res;
      });
    },
    [editing, setContent, content]
  );
  const editor = useDiaryInlineEditor({
    content: editorContent,
    placeholder: 'Start writing here, or click the menu to add a link block',
    autofocus: editing !== 0,
    onEnter,
    onBlur,
    onUpdate,
  });

  return (
    <div className="flex flex-col space-y-3 ">
      {content.map((v, idx) =>
        idx === editing ? (
          editor ? (
            <DiaryInlineEditor editor={editor} />
          ) : null
        ) : (
          <DiaryVerse onClick={() => setEditing(idx)} verse={v} />
        )
      )}
      <button type="button" className="button" onClick={appendPara}>
        New Paragraph
      </button>
    </div>
  );
}
