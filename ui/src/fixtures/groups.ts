import { Group } from '../types/groups';

const mockGroup: Group = {
  fleet: [],
  cabals: {},
  channels: {},
  cordon: {},
  meta: {
    title: 'Tlon Corporation',
    description:
      'We build infrastructre that is technically excellent, architecturally sound, and aesthetically beautiful',
    image: '',
  },
};

export const mockGroups = {
  '~zod/test': mockGroup,
};
