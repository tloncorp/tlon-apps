import { Clubs, ContactRolodex, Group } from '@tloncorp/shared/urbit';

declare global {
  interface Window {
    ship: string;
    desk: string;
    our: string;
    group: Group;
    multiDms: Clubs;
    contacts: ContactRolodex;
    contentInjected: boolean;
  }
}

declare module 'urbit-ob' {
  function isValidPatp(ship: string): boolean;
  function clan(ship: string): 'galaxy' | 'star' | 'planet' | 'moon' | 'comet';
}
