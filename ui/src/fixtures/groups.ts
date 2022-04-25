import { Group } from '../types/groups';

const mockGroupOne: Group = {
  fleet: [],
  cabals: {},
  channels: {
    'chat/~zod/test': {
      channel: 'chat',
      meta: {
        title: 'Watercooler',
        description:
          'General chat for the entire fleet.  Please keep it civil.',
        image: '',
      },
    },
  },
  cordon: {},
  meta: {
    title: 'Tlon Corporation',
    description:
      'We build infrastructre that is technically excellent, architecturally sound, and aesthetically beautiful',
    image: '',
  },
};

const mockGroupTwo: Group = {
  fleet: [],
  cabals: {},
  channels: {
    'chat/~zod/test': {
      channel: 'chat',
      meta: {
        title: 'Milady',
        description: 'Milady maker chatroom',
        image: '',
      },
    },
  },
  cordon: {},
  meta: {
    title: 'remco',
    description:
      'The urbit group for remilia, a digital art collective',
    image: '',
  },
}
export const mockGroups = {
  '~zod/tlon': mockGroupOne,
  '~zod/remco': mockGroupTwo,
};
