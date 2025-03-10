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
    this.dbPath = path.join(userDataPath, 'tlon.sqlite');
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

    console.log(`Executing ${method} query:`, sql, params);

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
      // Run each migration in a transaction
      for (const migration of migrations) {
        this.db!.exec('BEGIN TRANSACTION');
        try {
          for (const statement of migration.sql) {
            this.db!.exec(statement);
          }
          this.db!.exec('COMMIT');
        } catch (error) {
          console.error('Migration error:', error);
          this.db!.exec('ROLLBACK');
          throw error;
        }
      }

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

      console.log('Migrations completed successfully');
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
