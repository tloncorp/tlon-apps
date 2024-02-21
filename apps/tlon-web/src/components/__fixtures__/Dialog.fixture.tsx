import { useSelect, useValue } from 'react-cosmos/client';

import Dialog from '@/components/Dialog';

export default function DialogFixture() {
  const [containerClass] = useValue('Container Class', {
    defaultValue: ['w-full', 'sm:max-w-lg'],
  });
  const [closeType] = useSelect('Close Type', {
    options: ['app', 'default', 'header', 'lightbox', 'none'],
    defaultValue: 'default',
  });
  return (
    <Dialog
      defaultOpen
      containerClass={containerClass.join(' ')}
      close={closeType}
    >
      <div>Hi I'm the dialog content!</div>
    </Dialog>
  );
}
