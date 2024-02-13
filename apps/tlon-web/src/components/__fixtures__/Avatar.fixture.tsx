import { useSelect } from 'react-cosmos/client';

import Avatar from '../Avatar';

export default function AvatarFixture() {
  const [ship] = useSelect('Ship Name', {
    options: ['~zod', '~marnec', '~fabled-faster'],
  });

  const [size] = useSelect('Size', {
    options: ['xxs', 'xs', 'small', 'default', 'huge'],
  });

  return <Avatar ship={ship} size={size} />;
}
