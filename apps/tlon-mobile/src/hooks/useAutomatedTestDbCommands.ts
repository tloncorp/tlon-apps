import { AUTOMATED_TEST } from '@tloncorp/app/lib/envVars';
import {
  REQUIRED_SENTINEL_TABLES,
  ensureDbReady,
} from '@tloncorp/app/lib/nativeDb';
import { createDevLogger } from '@tloncorp/shared';
import { client } from '@tloncorp/shared/db/client';
import { sql } from 'drizzle-orm';
import { useEffect, useRef } from 'react';
import { Alert, Linking } from 'react-native';

const logger = createDevLogger('e2eDbCommands', false);
const E2E_DB_HOST = 'e2e';
const E2E_DB_PATH = '/db';

type E2eCorruptibleTable = (typeof REQUIRED_SENTINEL_TABLES)[number];
const CORRUPTIBLE_TABLES = new Set<E2eCorruptibleTable>([
  'groups',
  'channels',
  'posts',
  'activity_events',
]);

type E2eDbCommand = {
  op: 'drop-table' | 'assert-table-present' | 'assert-table-missing';
  table: E2eCorruptibleTable;
};

function parseE2eDbCommand(url: string): E2eDbCommand | null {
  try {
    const parsed = new URL(url);
    if (parsed.host !== E2E_DB_HOST || parsed.pathname !== E2E_DB_PATH) {
      return null;
    }

    const op = parsed.searchParams.get('op');
    const table = parsed.searchParams.get('table');
    if (!table || !CORRUPTIBLE_TABLES.has(table as E2eCorruptibleTable)) {
      return null;
    }

    if (
      op !== 'drop-table' &&
      op !== 'assert-table-present' &&
      op !== 'assert-table-missing'
    ) {
      return null;
    }

    return { op, table: table as E2eCorruptibleTable };
  } catch {
    return null;
  }
}

async function e2eDropTable(tableName: E2eCorruptibleTable) {
  await ensureDbReady();
  await client.run(sql.raw(`DROP TABLE IF EXISTS "${tableName}"`));
}

async function e2eAssertTableState(
  tableName: E2eCorruptibleTable,
  expectedState: 'present' | 'missing'
) {
  await ensureDbReady();

  let isPresent = true;
  try {
    await client.run(sql.raw(`SELECT 1 FROM "${tableName}" LIMIT 1`));
  } catch {
    isPresent = false;
  }

  const shouldBePresent = expectedState === 'present';
  if (isPresent !== shouldBePresent) {
    throw new Error(
      `e2eAssertTableState: expected "${tableName}" to be ${expectedState}, but it was ${isPresent ? 'present' : 'missing'}`
    );
  }
}

export function useAutomatedTestDbCommands() {
  const processedUrls = useRef(new Set<string>());

  useEffect(() => {
    if (!AUTOMATED_TEST) {
      return;
    }

    const handleUrl = async (url: string) => {
      if (processedUrls.current.has(url)) {
        return;
      }

      const command = parseE2eDbCommand(url);
      if (!command) {
        return;
      }
      processedUrls.current.add(url);

      logger.log('running automated test DB command', command);
      try {
        if (command.op === 'drop-table') {
          await e2eDropTable(command.table);
        } else {
          const expectedState =
            command.op === 'assert-table-present' ? 'present' : 'missing';
          await e2eAssertTableState(command.table, expectedState);
          Alert.alert(
            'E2E DB Check',
            `PASS: ${command.table} is ${expectedState}`
          );
        }
        logger.log('automated test DB command complete', command);
      } catch (error) {
        logger.error('automated test DB command failed', command, error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        Alert.alert('E2E DB Check', `FAIL: ${errorMessage}`);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        void handleUrl(url);
      }
    });

    const subscription = Linking.addEventListener('url', (event) => {
      void handleUrl(event.url);
    });

    return () => subscription.remove();
  }, []);
}
