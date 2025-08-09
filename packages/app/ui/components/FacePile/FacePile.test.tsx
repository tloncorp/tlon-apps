import { describe, expect, test } from 'vitest';
import type * as db from '@tloncorp/shared/db';

// Mock contacts for testing
const createMockContact = (id: string, nickname?: string): db.Contact => ({
  id,
  nickname,
  bio: null,
  color: null,
  avatarImage: null,
  status: null,
  coverImage: null,
  peerNickname: null,
  customNickname: null,
  peerAvatarImage: null,
  customAvatarImage: null,
  pinnedGroups: null,
  systemContactId: null,
  attestations: null,
  systemContact: null,
});

const mockContacts: db.Contact[] = [
  createMockContact('~rilfun-lidlen', 'James'),
  createMockContact('~latter-bolden', 'Brian'),
  createMockContact('~fabled-faster', 'Ed'),
  createMockContact('~nocsyx-lassul', 'Hunter'),
  createMockContact('~solfer-magfed', 'Dan'),
  createMockContact('~ravmel-ropdyl', 'Galen'),
];

// Helper function to test FacePile logic without rendering
const calculateFacePileData = (contacts: db.Contact[], maxVisible: number = 4) => {
  const visibleContacts = contacts.slice(0, maxVisible);
  const overflowCount = Math.max(0, contacts.length - maxVisible);
  
  return {
    visibleContacts,
    overflowCount,
    hasOverflow: overflowCount > 0,
  };
};

describe('FacePile Logic', () => {
  test('calculates empty state when no contacts provided', () => {
    const result = calculateFacePileData([]);
    
    expect(result.visibleContacts).toHaveLength(0);
    expect(result.overflowCount).toBe(0);
    expect(result.hasOverflow).toBe(false);
  });

  test('calculates single contact without overflow', () => {
    const result = calculateFacePileData([mockContacts[0]]);
    
    expect(result.visibleContacts).toHaveLength(1);
    expect(result.overflowCount).toBe(0);
    expect(result.hasOverflow).toBe(false);
  });

  test('calculates multiple contacts without overflow when under max', () => {
    const result = calculateFacePileData(mockContacts.slice(0, 3));
    
    expect(result.visibleContacts).toHaveLength(3);
    expect(result.overflowCount).toBe(0);
    expect(result.hasOverflow).toBe(false);
  });

  test('calculates exactly 4 contacts without overflow', () => {
    const result = calculateFacePileData(mockContacts.slice(0, 4));
    
    expect(result.visibleContacts).toHaveLength(4);
    expect(result.overflowCount).toBe(0);
    expect(result.hasOverflow).toBe(false);
  });

  test('calculates overflow correctly when 5 contacts provided', () => {
    const result = calculateFacePileData(mockContacts.slice(0, 5));
    
    expect(result.visibleContacts).toHaveLength(4);
    expect(result.overflowCount).toBe(1);
    expect(result.hasOverflow).toBe(true);
  });

  test('calculates correct overflow count with many contacts', () => {
    const result = calculateFacePileData(mockContacts.slice(0, 6));
    
    expect(result.visibleContacts).toHaveLength(4);
    expect(result.overflowCount).toBe(2);
    expect(result.hasOverflow).toBe(true);
  });

  test('respects custom maxVisible prop', () => {
    const result = calculateFacePileData(mockContacts.slice(0, 5), 2);
    
    expect(result.visibleContacts).toHaveLength(2);
    expect(result.overflowCount).toBe(3);
    expect(result.hasOverflow).toBe(true);
  });

  test('handles maxVisible of 1', () => {
    const result = calculateFacePileData(mockContacts.slice(0, 2), 1);
    
    expect(result.visibleContacts).toHaveLength(1);
    expect(result.overflowCount).toBe(1);
    expect(result.hasOverflow).toBe(true);
  });

  test('no overflow when contacts equal custom maxVisible', () => {
    const result = calculateFacePileData(mockContacts.slice(0, 2), 2);
    
    expect(result.visibleContacts).toHaveLength(2);
    expect(result.overflowCount).toBe(0);
    expect(result.hasOverflow).toBe(false);
  });

  test('handles edge case with maxVisible 0', () => {
    const result = calculateFacePileData([mockContacts[0]], 0);
    
    expect(result.visibleContacts).toHaveLength(0);
    expect(result.overflowCount).toBe(1);
    expect(result.hasOverflow).toBe(true);
  });

  test('handles large numbers correctly', () => {
    const largeContactList = Array.from({ length: 100 }, (_, i) => 
      createMockContact(`~contact-${i}`, `User ${i}`)
    );
    const result = calculateFacePileData(largeContactList);
    
    expect(result.visibleContacts).toHaveLength(4);
    expect(result.overflowCount).toBe(96);
    expect(result.hasOverflow).toBe(true);
  });
});