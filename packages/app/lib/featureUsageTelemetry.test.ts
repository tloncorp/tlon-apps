import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import {
  getChatListTelemetryEntity,
  getNavigationTelemetryTab,
  toHomeTelemetryFilter,
} from './featureUsageTelemetry';

describe('feature usage telemetry labels', () => {
  it('uses the user-facing All label for the internal home filter', () => {
    expect(toHomeTelemetryFilter('home')).toBe('all');
    expect(toHomeTelemetryFilter('groups')).toBe('groups');
    expect(toHomeTelemetryFilter('messages')).toBe('messages');
  });

  it.each([
    ['ChatList', 'home'],
    ['Activity', 'activity'],
    ['Contacts', 'contacts'],
    ['Settings', 'other'],
  ])('maps the %s route to %s', (route, expected) => {
    expect(getNavigationTelemetryTab(route)).toBe(expected);
  });

  it.each([
    [{ type: 'group' }, 'group'],
    [{ type: 'channel', channel: { type: 'dm' } }, 'direct_message'],
    [{ type: 'channel', channel: { type: 'groupDm' } }, 'group_message'],
    [{ type: 'channel', channel: { type: 'chat' } }, 'channel'],
  ])('classifies a chat-list row as %s', (item, expected) => {
    expect(getChatListTelemetryEntity(item as db.Chat)).toBe(expected);
  });
});
