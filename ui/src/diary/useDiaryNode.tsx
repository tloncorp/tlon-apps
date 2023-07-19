import { NodeViewProps } from '@tiptap/react';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef } from 'react';

export default function useDiaryNode(
  name: string,
  { node, getPos, editor, selected, updateAttributes }: NodeViewProps
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
    [updateAttributes, name]
  );

  const updateValues = useCallback(
    (val: string) => {
      updateAttributes({
        [name]: val,
      });
    },
    [name, updateAttributes]
  );

  const clear = useCallback(() => {
    updateAttributes({
      [name]: null,
    });
  }, [updateAttributes, name]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const foc = (n: number) =>
        editor.chain().focus(n, { scrollIntoView: true }).run();
      const pos = getPos();
      if ((e.key === 'Tab' && e.shiftKey === false) || e.key === 'ArrowRight') {
        foc(pos + 1);
        e.preventDefault();
      } else if ((e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowLeft') {
        foc(pos - 1);
        e.preventDefault();
      } else if (e.key === 'Backspace' && value.length === 0) {
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

  const onFocus = useCallback((e: React.FocusEvent) => {
    // editor.chain().focus(getPos()).run();
  }, []);
  return useMemo(
    () => ({ ref, onKeyDown, updateValues, onChange, value, clear, onFocus }),
    [ref, onKeyDown, updateValues, onChange, value, clear, onFocus]
  );
}
