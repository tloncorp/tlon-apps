import { Group, Vessel, Gangs } from '../types/groups';

const emptyVessel = (): Vessel => ({
  sects: [],
  joined: Date.now(),
});

const mockGroupOne: Group = {
  fleet: {
    '~hastuc-dibtux': emptyVessel(),
    '~finned-palmer': emptyVessel(),
    '~zod': emptyVessel(),
  },
  cabals: {},
  channels: {
    '~zod/test': {
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
  fleet: {},
  cabals: {},
  channels: {
    '~zod/test': {
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
    description: 'The urbit group for remilia, a digital art collective',
    image: '',
  },
};
const mockGroups = {
  '~zod/tlon': mockGroupOne,
  '~zod/remco': mockGroupTwo,
};

export const mockGangs: Gangs = {
  '~zod/structure': {
    invite: {
      text: 'Come join the group',
      ship: '~fabled-faster',
    },
    claim: {
      progress: 'adding',
      'join-all': true,
    },
    preview: {
      cordon: {
        afar: {
          app: '~zod/eth-verify',
          path: '/x/can-join/',
          desc: 'This group requires a'
        }
      },
      meta: {
        title: 'Structure',
        description:
          'Urbit Structural Design and Engineering Group. Always Thinking About Mechanics.',
        image:
          'https://fabled-faster.nyc3.digitaloceanspaces.com/fabled-faster/2022.1.27..17.59.43-image.png',
      },
    },
  },
};

export default mockGroups;
