import { ConsoleMessage, Page, expect } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';
import { test, testWithOptions } from './test-fixtures';

// This type doesn't seem included in this version of Playwright, even though it exists.
// Copied from https://github.com/microsoft/playwright/blob/22468c245e27949d4cbfb1755d724102ab0e6414/packages/protocol/src/channels.d.ts#L256-L278
type IndexedDBDatabase = {
  name: string;
  version: number;
  stores: {
    name: string;
    autoIncrement: boolean;
    keyPath?: string;
    keyPathArray?: string[];
    records: {
      key?: unknown;
      keyEncoded?: unknown;
      value?: unknown;
      valueEncoded?: unknown;
    }[];
    indexes: {
      name: string;
      keyPath?: string;
      keyPathArray?: string[];
      multiEntry: boolean;
      unique: boolean;
    }[];
  }[];
};

const SQLiteContentIdbConfig = {
  databaseName: 'keyValueStorage',
  storeName: 'keyValueStorage',
  key: 'sqliteContent',
};

testWithOptions({ installClock: true }).describe(
  'Database persistence error handling',
  () => {
    test('should gracefully handle corrupted database on load', async ({
      zodSetup,
    }) => {
      const zodPage = zodSetup.page;
      const consoleMsgs = captureConsole(zodPage);

      // Wait for initial load
      await expect(zodPage.getByText('Home')).toBeVisible();

      // Create some initial data to verify recovery starts fresh
      await helpers.createGroup(zodPage);
      const MESSAGE_TEXT_BEFORE_CORRUPT = 'Message before corruption';
      await helpers.sendMessage(zodPage, MESSAGE_TEXT_BEFORE_CORRUPT);
      await expect(
        zodPage.getByText(MESSAGE_TEXT_BEFORE_CORRUPT)
      ).toBeVisible();
      await zodPage.clock.fastForward(2000);

      // check that the DB file was saved / has content
      await expect(readSavedSqliteContent(zodPage)).toBeDefined();

      // Inject corrupted data into IndexedDB
      await zodPage.evaluate(async (config) => {
        const openReq = indexedDB.open(config.databaseName, 1);
        await new Promise((resolve, reject) => {
          openReq.onsuccess = () => {
            const db = openReq.result;
            const tx = db.transaction(config.storeName, 'readwrite');
            const store = tx.objectStore(config.storeName);

            // Create corrupted SQLite file content
            // (i.e. `CORRUPTED DATA CORRUPTED DATA...`)
            const corruptedString = 'CORRUPTED DATA '.repeat(10);
            store.put(corruptedString, config.key);
            tx.oncomplete = resolve;
            tx.onerror = reject;
          };
          openReq.onerror = reject;
        });
      }, SQLiteContentIdbConfig);

      // Navigate to home page to trigger DB load with corrupted data
      // (We need to `goto()` to trigger the load-from-file)
      const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;
      await zodPage.goto(zodUrl);

      // Wait for app to recover - should load successfully despite corruption
      await expect(zodPage.getByText('Home')).toBeVisible({ timeout: 30000 });

      // Verify the app logged the corruption and recovery
      await zodPage.waitForTimeout(2000);
      const hasCorruptionWarning = consoleMsgs.some(
        (log) =>
          log.includes('Failed to load DB from file') ||
          log.includes('continuing with empty DB')
      );
      expect(hasCorruptionWarning).toBe(true);

      // Verify app is functional after recovery with fresh DB
      await helpers.createGroup(zodPage);
      await checkCanSendMessage(zodPage);

      // Verify corrupted data is gone (fresh start)
      await expect(
        zodPage.getByText(MESSAGE_TEXT_BEFORE_CORRUPT)
      ).not.toBeVisible();
    });

    test('should handle storage quota exceeded during save', async ({
      zodSetup,
    }) => {
      const zodPage = zodSetup.page;

      await expect(zodPage.getByText('Home')).toBeVisible();

      // Set up console monitoring to catch save errors
      const consoleMsgs = captureConsole(zodPage);

      // Mock IndexedDB to throw QuotaExceededError on put operations for sqliteContent
      await zodPage.evaluate(() => {
        const originalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          // Only intercept sqliteContent saves (the large DB file)
          if (args.length >= 2 && args[1] === 'sqliteContent') {
            const error = new DOMException(
              'The quota has been exceeded.',
              'QuotaExceededError'
            );
            const request = {} as IDBRequest;
            setTimeout(() => {
              if (request.onerror) {
                request.onerror(new Event('error'));
              }
            }, 0);
            Object.defineProperty(request, 'error', {
              get() {
                return error;
              },
            });
            return request;
          }
          return originalPut.apply(this, args);
        };
      });

      // Trigger activity that would cause a DB save
      await helpers.createGroup(zodPage);
      await checkCanSendMessage(zodPage);

      // Wait for debounced save to execute (1000ms debounce + execution time)
      await zodPage.waitForTimeout(3000);

      // Verify error was logged but app continues to function
      const hasSaveError = consoleMsgs.some((log) =>
        log.includes('Failed to save to file')
      );
      expect(hasSaveError).toBe(true);

      // Verify app still works despite save failure
      await checkCanSendMessage(zodPage);
    });
  }
);

async function checkCanSendMessage(
  page: Page,
  message: string = `Test message ${Date.now()}`
) {
  await helpers.sendMessage(page, message);
  await expect(page.getByText(message)).toBeVisible();
}

async function readSavedSqliteContent(page: Page) {
  const storageSnapshot = await page
    .context()
    .storageState({ indexedDB: true });
  const origin = storageSnapshot.origins.find(
    (x) => x.origin === 'http://localhost:3000'
  );
  // @ts-expect-error - playwright types missing IndexedDBDatabase
  const idb = origin?.indexedDB as IndexedDBDatabase[];
  return idb
    .find((x) => x.name === SQLiteContentIdbConfig.databaseName)
    ?.stores.find((x) => x.name === SQLiteContentIdbConfig.storeName)
    ?.records.find((x) => x.key === SQLiteContentIdbConfig.key)?.value;
}

function captureConsole(page: Page) {
  const messages: ConsoleMessage[] = [];
  page.on('console', (msg) => {
    messages.push(msg);
  });
  return {
    messages,
    some(predicate: (text: string) => boolean) {
      return messages.some((m) => predicate(m.text()));
    },
  };
}
