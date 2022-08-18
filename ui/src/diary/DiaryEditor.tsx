import { parseInline, parseTipTapJSON } from '@/logic/tiptap';
import { NoteContent, VerseInline } from '@/types/diary';
import { Editor } from '@tiptap/react';
import React, { useCallback, useMemo, useState } from 'react';
import DiaryInlineEditor, { useDiaryInlineEditor } from './DiaryInlineEditor';
import { DiaryVerse } from './DiaryVerse';

export interface DiaryEditorProps {
  content: NoteContent;
  setContent: (c: NoteContent | ((con: NoteContent) => NoteContent)) => void;
}

export default function DiaryEditor(props: DiaryEditorProps) {
  const { content, setContent } = props;
  const [editing, setEditing] = useState(null as number | null);
  const editorContent = useMemo(() => {
    if (editing === null) {
      return '';
    }
    const target = (content[editing] as VerseInline).inline;
    if (target.length === 0) {
      return '';
    }
    return parseInline((content[editing] as VerseInline).inline);
  }, [editing, content]);

  const onBlur = useCallback(
    ({ editor }: { editor: Editor }) => {
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
      setContent((s) => [
        ...s.slice(0, editing),
        { inline },
        ...s.slice(editing + 1),
      ]);
    },
    [editing, setContent, content]
  );
  const editor = useDiaryInlineEditor({
    content: editorContent,
    placeholder: 'Start writing here, or click the menu to add a link block',
    onBlur,
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
      <button
        type="button"
        className="button"
        onClick={() => {
          setContent((cs) => [...cs, { inline: [] }]);
          setEditing(content.length);
        }}
      >
        New Paragraph
      </button>
    </div>
  );
}
