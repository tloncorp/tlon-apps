import { useParams } from 'react-router';

const useGroupIdFromRoute = () => {
  const { ship, name } = useParams<{ ship: string; name: string }>();
  const groupId = `${ship}/${name}`;
  return groupId;
};

export default useGroupIdFromRoute;
