import { faker } from '@faker-js/faker';
import {
  Cordon,
  Gang,
  Gangs,
  Group,
  GroupIndex,
  GroupPreview,
  PrivacyType,
  Vessel,
} from '@tloncorp/shared/dist/urbit/groups';

import { AUTHORS } from '@/constants';
import { randomElement } from '@/logic/utils';

const emptyVessel = (): Vessel => ({
  sects: [],
  joined: Date.now(),
});

const adminVessel = (): Vessel => ({
  sects: ['admin'],
  joined: Date.now(),
});

const randomColor = () => Math.floor(Math.random() * 16777215).toString(16);

export function makeCordon(privacy = 'public') {
  let cordon: Cordon;
  switch (privacy) {
    case 'public':
      cordon = {
        open: {
          ships: [],
          ranks: [],
        },
      };
      break;
    case 'private':
      cordon = {
        shut: {
          ask: [],
          pending: [],
        },
      };
      break;
    default:
      cordon = {
        afar: {
          app: '',
          path: '',
          desc: '',
        },
      };
      break;
  }
  return cordon;
}

export function makeGroupPreview(privacy = 'public'): GroupPreview {
  return {
    flag: '~zod/test',
    cordon: makeCordon(privacy),
    time: Date.now(),
    meta: {
      title: faker.company.name(),
      description: faker.company.catchPhrase(),
      image: `#${randomColor()}`,
      cover: `#${randomColor()}`,
    },
    secret: false,
  };
}

export function createMockGang({
  flag,
  hasClaim = false,
  hasInvite = false,
  hasPreview = false,
  privacy = 'public',
}: {
  flag: string;
  hasClaim?: boolean;
  hasInvite?: boolean;
  hasPreview?: boolean;
  privacy?: PrivacyType;
}): Gang {
  return {
    claim: hasClaim
      ? {
          progress: 'done',
          'join-all': false,
        }
      : null,
    invite: hasInvite
      ? {
          flag,
          ship: randomElement(AUTHORS),
        }
      : null,
    preview: hasPreview ? makeGroupPreview(privacy) : null,
  };
}

export function createMockIndex(ship: string): GroupIndex {
  return {
    [`~${ship}/some-public-group`]: makeGroupPreview(),
    [`~${ship}/some-private-group`]: makeGroupPreview('private'),
    [`~${ship}/some-secret-group`]: makeGroupPreview('secret'),
  };
}

export function createMockGroup(title: string): Group {
  return {
    fleet: {
      '~hastuc-dibtux': emptyVessel(),
      '~finned-palmer': adminVessel(),
      '~zod': emptyVessel(),
    },
    cabals: {
      admin: {
        meta: {
          title: 'Admin',
          description: '',
          image: '',
          cover: '',
        },
      },
      member: {
        meta: {
          title: 'Member',
          description: '',
          image: '',
          cover: '',
        },
      },
    },
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
      cover: '',
    },
    zones: {
      default: {
        meta: {
          title: 'Sectionless',
          cover: '',
          image: '',
          description: '',
        },
        idx: [],
      },
    },
    bloc: [],
    'zone-ord': ['default'],
    secret: false,
    saga: { synced: null },
    'flagged-content': {},
  };
}
const mockGroupOne: Group = {
  fleet: {
    '~finned-palmer': emptyVessel(),
    '~zod': adminVessel(),
    '~tocref-ripmyr': emptyVessel(),
    '~hastuc-dibtux': emptyVessel(),
    '~fallyn-balfus': emptyVessel(),
    '~fabled-faster': emptyVessel(),
    '~rilfun-lidlen': emptyVessel(),
    '~nocsyx-lassul': emptyVessel(),
  },
  cabals: {
    admin: {
      meta: {
        title: 'Admin',
        description: '',
        image: '',
        cover: '',
      },
    },
    member: {
      meta: {
        title: 'Member',
        description: '',
        image: '',
        cover: '',
      },
    },
  },
  channels: {
    'chat/~dev/test': {
      meta: {
        title: 'Watercooler',
        description: 'watering hole',
        image: '',
        cover: '',
      },
      added: 1657774188151,
      join: false,
      readers: [],
      zone: 'default',
    },
  },
  cordon: {
    open: {
      ranks: ['czar'],
      ships: ['~bus'],
    },
  },
  meta: {
    title: 'tlon',
    description: 'the tlon corporation',
    image: '',
    cover: '',
  },
  zones: {
    default: {
      meta: {
        title: 'Sectionless',
        cover: '',
        image: '',
        description: '',
      },
      idx: ['/chat/~dev/test'],
    },
  },
  bloc: [],
  'zone-ord': ['default'],
  secret: false,
  saga: { synced: null },
  'flagged-content': {},
};

const mockGroupTwo: Group = {
  fleet: {
    '~finned-palmer': adminVessel(),
  },
  cabals: {
    admin: {
      meta: {
        title: 'Admin',
        description: '',
        image: '',
        cover: '',
      },
    },
    member: {
      meta: {
        title: 'Member',
        description: '',
        image: '',
        cover: '',
      },
    },
  },
  channels: {
    'chat/~zod/test': {
      meta: {
        title: 'Milady',
        description: 'Milady maker chatroom',
        image: '',
        cover: '',
      },
      added: 1657774188151,
      join: true,
      readers: [],
      zone: 'default',
    },
    'heap/~zod/testHeap': {
      meta: {
        title: 'Martini Gallery',
        description: 'Martini Maker Gallery',
        image: '',
        cover: '',
      },
      added: 1657774188151,
      join: true,
      readers: [],
      zone: 'default',
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
    cover: '',
  },
  zones: {
    default: {
      meta: {
        title: 'Sectionless',
        cover: '',
        image: '',
        description: '',
      },
      idx: ['heap/~zod/testHeap', 'chat/~zod/test'],
    },
  },
  bloc: [],
  'zone-ord': ['default'],
  secret: false,
  saga: { synced: null },
  'flagged-content': {},
};

const mockGroups: { [flag: string]: Group } = {
  '~zod/remco': mockGroupTwo,
  '~dev/tlon': mockGroupOne,
};

export function createChannel(title: string) {
  return {
    meta: {
      title,
      description: 'Do some chatting',
      image: '',
      cover: '',
    },
    added: 1657774188151,
    join: false,
    readers: [],
    zone: 'default',
  };
}

for (let i = 0; i < 20; i += 1) {
  const group = createMockGroup(faker.company.name());

  for (let j = 0; j < 20; j += 1) {
    group.channels[`/chat/~zod/tlon${i}${j}`] = createChannel(j.toString());
    group.zones.default.idx.push(`/chat/~zod/tlon${i}${j}`);
  }

  mockGroups[`~zod/tlon${i}`] = group;
}

export const mockGangs: Gangs = {
  '~zod/structure': {
    invite: {
      flag: '~zod/structure',
      ship: '~fabled-faster',
    },
    claim: {
      progress: 'adding',
      'join-all': true,
    },
    preview: {
      flag: '~zod/structure',
      time: Date.now(),
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
        cover: '',
      },
      secret: false,
    },
  },
};

export const pinnedGroups = ['~zod/remco', '~dev/tlon'];

export default mockGroups;
