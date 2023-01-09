import React, { useCallback, useRef } from 'react';

interface ModalOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  dismiss: () => void;
}
type Props = ModalOverlayProps;
export default function ModalOverlay({ dismiss, ...props }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onClick = useCallback(
    (e: any) => {
      if (!(ref as any).current.contains(e.target)) {
        dismiss();
      }
      e.stopPropagation();
    },
    [dismiss, ref]
  );

  const onKeyDown = useCallback(
    (e: any) => {
      if (e.key === 'Escape') {
        dismiss();
        e.stopPropagation();
      }
    }, [dismiss]);

  return (
    <div className='bg-black-20 fixed left-0 top-0 z-10 flex h-full w-full items-center justify-center'
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div ref={ref} {...props} />
    </div>
  );
}
