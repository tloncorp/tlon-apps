import type { Club } from '@/types/dms';

import ShipName from './ShipName';

type Props = {
  club: Club;
};

export default function ClubName({ club }: Props) {
  const ships = club.team.concat(club.hive);
  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <>
      {club.meta.title ||
        ships.map((member: string, i: number) => (
          <span key={member}>
            <ShipName name={member} showAlias />
            {i !== ships.length - 1 ? ', ' : null}
          </span>
        ))}
    </>
  );
}
