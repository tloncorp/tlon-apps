import { useCreateMutation } from '@/state/channel/channel';
import { useCreateGroupMutation } from '@/state/groups';
import { useNavigate } from 'react-router';

export default function useCreateDefaultGroup() {
  const { mutateAsync: createGroupMutation, isLoading } =
    useCreateGroupMutation();
  const { mutateAsync: createChannelMutation, isLoading: channelIsLoading } =
    useCreateMutation();
  const navigate = useNavigate();

  async function createGroup({
    title,
    shortCode,
  }: {
    title: string;
    shortCode: string;
  }) {
    if (!title || !shortCode) return;

    try {
      await createGroupMutation({
        title,
        description: '',
        image: '#999999',
        cover: '#D9D9D9',
        name: shortCode,
        members: {},
        cordon: {
          open: {
            ships: [],
            ranks: [],
          },
        },
        secret: false,
      });

      const flag = `${window.our}/${shortCode}`;
      navigate(`/groups/${flag}`);

      const randomNumber = Math.floor(Math.random() * 10000);
      await createChannelMutation({
        kind: 'chat',
        group: flag,
        name: `welcome-${randomNumber}`,
        title: 'Welcome',
        description: 'Welcome to your new group!',
        readers: [],
        writers: [],
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Couldn't create group", error);
    }
  }

  return { createGroup, loading: isLoading || channelIsLoading };
}
