import { Editor } from '@tiptap/react';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef } from 'react';

interface UseDiaryNodeProps {
  getPos: () => number;
  editor: Editor;
  selected: boolean;
  node: any;
  updateAttributes: any;
}

export default function useDiaryNode(
  name: string,
  { node, getPos, editor, selected, updateAttributes }: UseDiaryNodeProps
) {
  const ref = useRef<HTMLInputElement>(null);
  const value = node.attrs[name] || '';
  useEffect(() => {
    if (selected && ref.current) {
      ref.current.focus();
    }
  }, [selected]);
  const onChange = useCallback(
    (ev: ChangeEvent<HTMLInputElement>) => {
      const val = ev.target.value;
      updateAttributes({
        [name]: val,
      });
    },
    [updateAttributes]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      console.log(e.key);
      const foc = (n: number) => editor.chain().focus(n).run();
      const pos = getPos();
      if ((e.key === 'Tab' && e.shiftKey === false) || e.key === 'ArrowRight') {
        foc(pos + 1);
        e.preventDefault();
      } else if ((e.key == 'Tab' && e.shiftKey) || e.key === 'ArrowLeft') {
        foc(pos - 1);
        e.preventDefault();
      } else if (e.key == 'Backspace' && value.length === 0) {
        editor
          .chain()
          .focus()
          .deleteRange({
            from: pos,
            to: pos + 1,
          })
          .run();
        e.preventDefault();
      }
    },
    [editor, getPos, value]
  );
  return useMemo(
    () => ({ ref, onKeyDown, onChange, value }),
    [ref, onKeyDown, onChange, value]
  );
}
