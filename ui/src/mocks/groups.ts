import { Group, Vessel, Gangs } from '../types/groups';

const emptyVessel = (): Vessel => ({
  sects: [],
  joined: Date.now(),
});

function createMockGroup(title: string): Group {
  return {
    fleet: {
      '~hastuc-dibtux': emptyVessel(),
      '~finned-palmer': emptyVessel(),
      '~zod': emptyVessel(),
    },
    cabals: {},
    channels: {},
    cordon: {
      open: {
        ranks: ['czar'],
        ships: ['~bus'],
      },
    },
    meta: {
      title,
      description:
        'We build infrastructre that is technically excellent, architecturally sound, and aesthetically beautiful',
      image:
        'https://nyc3.digitaloceanspaces.com/hmillerdev/nocsyx-lassul/2022.6.14..18.37.11-Icon Box.png',
    },
  };
}

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
  cordon: {
    open: {
      ranks: ['czar'],
      ships: ['~bus'],
    },
  },
  meta: {
    title: 'remco',
    description: 'The urbit group for remilia, a digital art collective',
    image: '',
  },
};

const mockGroups: { [flag: string]: Group } = {
  '~zod/remco': mockGroupTwo,
};

const emptyChannel = {
  meta: {
    title: 'Watercooler',
    description: 'Do some chatting',
    image: '',
  },
};

for (let i = 0; i < 20; i += 1) {
  const group = createMockGroup(`Tlon Corporation ${i}`);

  for (let j = 0; j < 20; j += 1) {
    group.channels[`~zod/tlon${i}${j}`] = emptyChannel;
  }

  mockGroups[`~zod/tlon${i}`] = group;
}

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
          desc: 'This group requires a',
        },
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
