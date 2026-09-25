import type * as ub from '../../urbit';
import type { NotesAction } from '../notesApi';

type Pins = { add: string } | { del: string } | { 'set-order': string[] };
type ContactKip = { kip: string; contact: ub.ContactBookProfileEdit };

// A poke's mark names its payload type, as it does on the desk.
export interface PokePayloads {
  'activity-action': ub.ActivityAction;
  'activity-action-1': ub.ActivityAction;
  'activity-action-2': ub.ActivityAction;
  'channel-action-2':
    | ub.ChannelsAction
    | { 'toggle-post': { show: string } | { hide: string } };
  'chat-block-ship': { ship: string };
  'chat-club-action-2': ub.ClubAction;
  'chat-club-create': ub.ClubCreate;
  'chat-dm-action-2': ub.DmAction;
  'chat-dm-rsvp': ub.DmRsvp;
  'chat-negotiate': string;
  'chat-remark-action': { whom: string; diff: { read: null } };
  'chat-toggle-message': ub.ToggleMessage;
  'chat-unblock-ship': { ship: string };
  'contact-action': ub.ContactsAction;
  'contact-action-1':
    | { self: ub.ContactBookProfileEdit }
    | { meet: string[] }
    | { edit: ContactKip }
    | { page: ContactKip }
    | { wipe: string[] };
  'group-action-5': ub.GroupActionV5;
  'group-cancel': string;
  'group-join': { flag: string; 'join-all': boolean };
  'group-knock': string;
  'group-leave': string;
  'group-rescind': string;
  'grouper-enable': string;
  'invite-decline': string;
  'notes-action': NotesAction;
  'notify-client-action': {
    'connect-provider-with-binding': {
      who: string;
      service: string;
      address: string;
      binding: string;
    };
  };
  'presence-action-1': ub.PresenceAction;
  'reel-describe': {
    token: string;
    metadata: { tag: string; fields: Record<string, string | undefined> };
  };
  'run-check': string;
  'settings-event': ub.SettingsEvent['settings-event'];
  'steward-action-1': ub.StewardConfigure;
  'steward-gateway-action-1': ub.StewardGatewayAction;
  'steward-lens-action-1': { retry: { bot: string; id: string } };
  'ui-action': { pins: Pins };
  'ui-add-contact-suggestions': string[];
  'ui-hide-contact': string;
  'ui-vita-toggle': boolean;
}

export type PayloadOf<E extends { mark: string }> =
  E['mark'] extends keyof PokePayloads ? PokePayloads[E['mark']] : unknown;

// Untyped today (json falls to unknown):
// - lanyard-command-1, lanyard-query-1: sent only as nouns (pokeNounRequest).
