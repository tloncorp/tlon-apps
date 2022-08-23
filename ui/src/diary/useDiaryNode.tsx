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
      const foc = (n: number) => editor.chain().focus(n).run();
      const pos = getPos();
      console.log(e);
      if ((e.key === 'Tab' && e.shiftKey === false) || e.key === 'ArrowRight') {
        foc(pos + 1);
        e.preventDefault();
      } else if ((e.key == 'Tab' && e.shiftKey) || e.key === 'ArrowLeft') {
        foc(pos - 1);
        e.preventDefault();
      }
    },
    [editor, getPos]
  );
  return useMemo(
    () => ({ ref, onKeyDown, onChange, value }),
    [ref, onKeyDown, onChange, value]
  );
}
