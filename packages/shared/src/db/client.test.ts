import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getClient, setupDb } from '../test/helpers';
import {
  DatabaseNotSetError,
  setClient,
  shouldReportQueryError,
} from './client';

describe('shouldReportQueryError', () => {
  beforeAll(() => {
    setupDb();
  });

  // Re-registering the client clears the "already reported" latch, which is
  // what makes these cases independent of each other.
  beforeEach(() => {
    setClient(getClient()!);
  });

  it('reports ordinary query errors every time', () => {
    const error = new Error('no such table: posts');
    expect(shouldReportQueryError(error)).toBe(true);
    expect(shouldReportQueryError(error)).toBe(true);
  });

  it('reports a missing database once and suppresses the rest', () => {
    expect(shouldReportQueryError(new DatabaseNotSetError())).toBe(true);
    expect(shouldReportQueryError(new DatabaseNotSetError())).toBe(false);
    expect(shouldReportQueryError(new DatabaseNotSetError())).toBe(false);
  });

  it('keeps reporting unrelated errors while a missing database is suppressed', () => {
    expect(shouldReportQueryError(new DatabaseNotSetError())).toBe(true);
    expect(shouldReportQueryError(new DatabaseNotSetError())).toBe(false);
    expect(shouldReportQueryError(new Error('disk I/O error'))).toBe(true);
  });

  it('re-arms once a client is registered', () => {
    expect(shouldReportQueryError(new DatabaseNotSetError())).toBe(true);
    expect(shouldReportQueryError(new DatabaseNotSetError())).toBe(false);

    setClient(getClient()!);

    expect(shouldReportQueryError(new DatabaseNotSetError())).toBe(true);
  });
});
