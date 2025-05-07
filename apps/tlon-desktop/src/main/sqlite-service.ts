import BetterSqlite3 from 'better-sqlite3';
import { app, ipcMain } from 'electron';
import path from 'path';

import { TRIGGER_SETUP } from './triggers';

class SQLiteService {
  private db: ReturnType<typeof BetterSqlite3> | null = null;
  private dbPath: string;
  private isProcessingChanges: boolean = false;
  private changesPending: boolean = false;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dbName = app.isPackaged ? 'tlon.sqlite' : 'tlon-dev.sqlite';
    this.dbPath = path.join(userDataPath, dbName);
    console.log(
      `Using ${app.isPackaged ? 'production' : 'development'} database at: ${this.dbPath}`
    );
  }

  async init() {
    if (this.db) return;

    try {
      console.log('Opening SQLite database at:', this.dbPath);
      this.db = new BetterSqlite3(this.dbPath, {
        verbose:
          process.env.NODE_ENV === 'development' ? console.log : undefined,
      });

      // Configure SQLite optimizations
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('temp_store = MEMORY');
      this.db.pragma('mmap_size = 268435456'); // 256MB mmap
      this.db.pragma('foreign_keys = false'); // this matches the default behavior of SQLite (foreign keys are off in both the web and mobile implementations of SQLite that we're using)

      // Set up change notification function
      this.db.function('notifyChanges', (changeData: string) => {
        try {
          const changeObj = JSON.parse(changeData);
          this.notifyRenderer(changeObj);
        } catch (error) {
          console.error('Error parsing change data:', error);
        }
      });

      console.log('SQLite database opened successfully');
    } catch (error) {
      console.error('Failed to open SQLite database:', error);
      throw error;
    }
  }

  private notifyRenderer(changeData: any) {
    // Send change notification to all renderer processes
    const windows = require('electron').BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('sqlite:change', changeData);
      }
    }
  }

  private toDrizzleResult(
    rows: Record<string, any> | Array<Record<string, any>>
  ) {
    if (!rows) return [];

    if (Array.isArray(rows)) {
      return rows.map((row) => {
        return Object.keys(row).map((key) => row[key]);
      });
    } else {
      return Object.keys(rows).map((key) => rows[key]);
    }
  }

  async executeQuery(sql: string, params: any[], method: string = 'all') {
    if (!this.db) await this.init();

    // console.log(`Executing ${method} query:`, sql, params);

    try {
      if (method === 'run') {
        // For insert/update/delete operations
        const stmt = sqliteService.db.prepare(sql);
        const result = params ? stmt.run(...params) : stmt.run();
        return {
          lastInsertRowid: result.lastInsertRowid,
          changes: result.changes,
        };
      } else if (method === 'get') {
        // For getting a single row
        const stmt = sqliteService.db.prepare(sql);
        const row = params ? stmt.raw().get(...params) : stmt.raw().get();
        return row || null;
      } else if (method === 'all') {
        // For getting multiple rows
        const stmt = sqliteService.db.prepare(sql);
        const rows = params ? stmt.raw().all(...params) : stmt.raw().all();
        return this.toDrizzleResult(rows);
      } else if (method === 'values') {
        // For getting raw values (not objects)
        const stmt = sqliteService.db.prepare(sql);
        const rows = params ? stmt.raw().all(...params) : stmt.raw().all();
        return this.toDrizzleResult(rows);
      } else {
        throw new Error(`Unsupported method: ${method}`);
      }
    } catch (error) {
      console.error('SQL error:', error);
      throw error;
    }
  }

  async runMigrations(migrations: any[]) {
    if (!this.db) await this.init();

    console.log('Starting migrations');
    try {
      // Create migrations table if it doesn't exist
      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS __migrations (
          id TEXT PRIMARY KEY,
          applied_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);

      // Run each migration in a transaction, but only if not already applied
      let migrationsApplied = 0;
      for (const migration of migrations) {
        // Skip if no SQL statements
        if (!migration.sql || migration.sql.length === 0) continue;

        // Generate a hash for this migration based on its content
        const migrationId = `migration_${migration.sql.join('').length}_${migration.sql[0].substring(0, 50).replace(/[^a-zA-Z0-9]/g, '')}`;

        // Check if this migration has already been applied
        const alreadyApplied = this.db!.prepare(
          'SELECT id FROM __migrations WHERE id = ?'
        ).get(migrationId);

        if (alreadyApplied) {
          console.log(`Skipping already applied migration: ${migrationId}`);
          continue;
        }

        console.log(`Applying migration: ${migrationId}`);
        this.db!.exec('BEGIN TRANSACTION');
        try {
          for (const statement of migration.sql) {
            try {
              this.db!.exec(statement);
            } catch (statementError) {
              // If table already exists, just continue
              if (
                statementError.message &&
                statementError.message.includes('already exists')
              ) {
                console.log(
                  `Table already exists, continuing with migration: ${statementError.message}`
                );
              } else {
                // For other errors, rollback and throw
                throw statementError;
              }
            }
          }

          // Record this migration as applied
          this.db!.prepare('INSERT INTO __migrations (id) VALUES (?)').run(
            migrationId
          );
          this.db!.exec('COMMIT');
          migrationsApplied++;
        } catch (error) {
          console.error('Migration error:', error);
          this.db!.exec('ROLLBACK');
          throw error;
        }
      }

      console.log(
        `Migrations completed successfully. Applied ${migrationsApplied} new migrations.`
      );

      // Set up triggers for database operations
      this.db!.exec(TRIGGER_SETUP);
      // Set up change notification trigger
      this.db!.exec(`
            CREATE TRIGGER IF NOT EXISTS after_changes_insert
            AFTER INSERT ON __change_log
            BEGIN
              SELECT notifyChanges(json_object(
                'table', NEW.table_name, 
                'operation', NEW.operation, 
                'data', NEW.row_data
              ));
            END;
          `);
    } catch (error) {
      console.error('Failed to run migrations:', error);
      throw error;
    }
  }

  async purgeDb() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    const fs = require('fs');
    if (fs.existsSync(this.dbPath)) {
      try {
        fs.unlinkSync(this.dbPath);
        console.log('Database file deleted');
      } catch (e) {
        console.error('Failed to delete database file:', e);
      }
    }

    // Also delete WAL files
    const walPath = this.dbPath + '-wal';
    const shmPath = this.dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    await this.init();
  }

  getDbPath() {
    return this.dbPath;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Create and export the service singleton
const sqliteService = new SQLiteService();

// Set up IPC handlers
export function setupSQLiteIPC() {
  ipcMain.handle('sqlite:init', async () => {
    await sqliteService.init();
    return true;
  });

  ipcMain.handle('sqlite:execute', async (_, { sql, params, method }) => {
    return await sqliteService.executeQuery(sql, params, method);
  });

  ipcMain.handle('sqlite:migrations', async (_, { migrations }) => {
    await sqliteService.runMigrations(migrations);
    return true;
  });

  ipcMain.handle('sqlite:purge', async () => {
    await sqliteService.purgeDb();
    return true;
  });

  ipcMain.handle('sqlite:get-path', () => {
    return sqliteService.getDbPath();
  });

  // Clean up on app quit
  app.on('will-quit', () => {
    sqliteService.close();
  });
}

export { sqliteService };
