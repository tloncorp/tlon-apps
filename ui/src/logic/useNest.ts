import { useParams } from 'react-router';

export default function useNest() {
  const { app, chShip, chName } = useParams();

  const chFlag = `${chShip}/${chName}`;
  return `${app}/${chFlag}`;
}
