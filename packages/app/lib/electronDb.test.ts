import { describe, expect, test } from 'vitest';

import { formatElectronMigrations } from './electronMigrations';

describe('formatElectronMigrations', () => {
  test('splits generated files so upgrades can continue past existing tables', () => {
    const formatted = formatElectronMigrations({
      journal: {
        entries: [{ tag: '0000_test' }],
      },
      migrations: {
        m0000: [
          'CREATE TABLE existing_table (id text);',
          '--> statement-breakpoint',
          'CREATE TABLE new_table (id text);',
        ].join('\n'),
      },
    });

    expect(formatted).toEqual([
      {
        sql: [
          'CREATE TABLE existing_table (id text);',
          'CREATE TABLE new_table (id text);',
        ],
      },
    ]);
  });
});
