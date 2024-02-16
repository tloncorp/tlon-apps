import { useValue } from 'react-cosmos/client';

import Divider from '@/components/Divider';

export default function DividerFixture() {
  const [isMobile] = useValue('Is mobile', { defaultValue: false });
  return (
    <div>
      <p>Some text</p>
      <Divider isMobile={isMobile} />
      <p>Some other text</p>
    </div>
  );
}
