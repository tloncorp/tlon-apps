import type {
	DataMessage,
	DestroyMessage,
	QueryMessage,
	TransactionMessage,
	ProcessorConfig,
	FunctionMessage,
	UserFunction,
	CallbackUserFunction,
	OutputMessage,
	InputMessage,
	// ImportMessage,
} from './types';
// Import the asynchronous WASM build because we will be using IndexedDB
// which is an async Virtual File System (VFS).
import SQLiteAsyncESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';

import { Mutex } from 'async-mutex';

import * as SQLite from 'wa-sqlite';

// This is the recommended IndexedDB VFS
// It is preferable over OPFS because OPFS works only in a worker
// and is not yet supported on all browsers
// see: https://github.com/rhashimoto/wa-sqlite/tree/master/src/examples
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js';

type SqlValue = string | number | null | Uint8Array | bigint;

// type Row = { [key: string]: SqlValue };

// interface QueryExecResult {
// columns: string[];
// values: SqlValue[][];
// }

// const resultToRows = (res: QueryExecResult): Row[] => {
// const cols = res.columns;
// return res.values.map((values: SqlValue[]) => {
// const row: Row = {};

// values.forEach((val: SqlValue, i: number) => {
// const col = cols[i];
// row[col] = val;
// });

// return row;
// });
// };

export class SQLocalProcessor {
	#mutex: Mutex;

	protected sqlite3: SQLiteAPI | undefined;
	protected db: number | undefined;
	protected config: ProcessorConfig = {};
	protected queuedMessages: InputMessage[] = [];
	protected userFunctions = new Map<string, UserFunction>();

	onmessage: ((message: OutputMessage) => void) | undefined;

	constructor() {
		this.init();
    // mutex is necessary to ensure that sql statements are not interleaved
		this.#mutex = new Mutex();
	}

	protected init = async () => {
		if (!this.config.databasePath) return;

		try {
			if (!this.sqlite3 || this.sqlite3 === undefined) {
				const SQLiteAsyncModule = await SQLiteAsyncESMFactory();
				this.sqlite3 = SQLite.Factory(SQLiteAsyncModule);
			}

			this.sqlite3.vfs_register(
				new IDBBatchAtomicVFS(this.config.databasePath)
			);

			this.db = await this.sqlite3.open_v2(
				this.config.databasePath
			);
		} catch (error) {
			this.emitMessage({
				type: 'error',
				error,
				queryKey: null,
			});

			this.sqlite3?.close(this.db);
			this.db = undefined;
			this.sqlite3 = undefined;
			return;
		}

		this.userFunctions.forEach(this.initUserFunction);
		this.flushQueue();
	};

	postMessage = (message: InputMessage | MessageEvent<InputMessage>) => {
		if (message instanceof MessageEvent) {
			message = message.data;
		}

		if (!this.db && message.type !== 'config') {
			this.queuedMessages.push(message);
			return;
		}

		switch (message.type) {
			case 'config':
				this.editConfig(message.key, message.value);
				break;
			case 'query':
			case 'transaction':
				this.exec(message);
				break;
			case 'function':
				this.createCallbackFunction(message);
				break;
			// case 'import':
			// this.importDb(message);
			// break;
			case 'destroy':
				this.destroy(message);
				break;
		}
	};

	protected emitMessage = (message: OutputMessage) => {
		if (this.onmessage) {
			this.onmessage(message);
		}
	};

	protected editConfig = <T extends keyof ProcessorConfig>(
		key: T,
		value: ProcessorConfig[T]
	) => {
		if (this.config[key] === value) return;

		this.config[key] = value;

		if (key === 'databasePath') {
			this.init();
		}
	};

	protected exec = async (message: QueryMessage | TransactionMessage) => {
		if (!this.db) return;
		if (!this.sqlite3) return;

		const release = await this.#mutex.acquire();

		try {
			const response: DataMessage = {
				type: 'data',
				queryKey: message.queryKey,
				rows: [],
				columns: [],
			};

			switch (message.type) {
				case 'query':
					// const rows = this.sqlite3.exec(this.db, {
					// sql: message.sql,
					// bind: message.params,
					// returnValue: 'resultRows',
					// rowMode: 'array',
					// columnNames: response.columns,
					// });

					for await (const stmt of this.sqlite3.statements(
						this.db,
						message.sql
					)) {
						// const { rows } = await this.sqlite3.execWithParams(
						// this.db,
						// message.sql,
						// message.params
						// );

						if (typeof message.params !== 'undefined') {
							this.sqlite3.bind_collection(stmt, message.params);
						}

						const rows: SqlValue[][] = [];
						let cols: string[] = [];

						while ((await this.sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
							cols = cols.length === 0 ? this.sqlite3.column_names(stmt) : cols;
							const row = this.sqlite3.row(stmt) as SqlValue[];
							rows.push(row);
						}

						switch (message.method) {
							case 'run':
								break;
							case 'get':
								response.rows = rows[0];
								break;
							case 'all':
							default:
								response.rows = rows;
								break;
						}
					}

					break;

				case 'transaction':
					// this.db.transaction((db: Sqlite3Db) => {
					// for (let statement of message.statements) {
					// db.exec({
					// sql: statement.sql,
					// bind: statement.params,
					// });
					// }
					// });

					// `statements` is a convenience function that manages statement compilation
					// such that we don't have to prepare and finalize statements ourselves
					// cf. https://rhashimoto.github.io/wa-sqlite/docs/interfaces/SQLiteAPI.html#statements
					for (const statement of message.statements) {
						for await (const stmt of this.sqlite3.statements(
							this.db,
							statement.sql
						)) {
							if (typeof statement.params !== 'undefined') {
								this.sqlite3.bind_collection(stmt, statement.params);
							}
						}
					}
					break;
			}

			this.emitMessage(response);
		} catch (error) {
			this.emitMessage({
				type: 'error',
				error,
				queryKey: message.queryKey,
			});
		} finally {
			release();
		}
	};

	protected createCallbackFunction = (message: FunctionMessage) => {
		const { functionName, queryKey } = message;
		const handler = (...args: any[]) => {
			this.emitMessage({
				type: 'callback',
				name: functionName,
				args: args,
			});
		};

		if (this.userFunctions.has(functionName)) {
			this.emitMessage({
				type: 'error',
				error: new Error(
					`A user-defined function with the name "${functionName}" has already been created for this SQLocal instance.`
				),
				queryKey,
			});
			return;
		}

		try {
			const callbackFunction: CallbackUserFunction = {
				type: 'callback',
				name: functionName,
				handler,
			};

			this.initUserFunction(callbackFunction);
			this.userFunctions.set(functionName, callbackFunction);

			this.emitMessage({
				type: 'success',
				queryKey,
			});
		} catch (error) {
			this.emitMessage({
				type: 'error',
				error,
				queryKey,
			});
		}
	};

	protected initUserFunction = (fn: UserFunction) => {
		if (!this.db) return;
		if (!this.sqlite3) return;

		// this.db.createFunction(
		// fn.name,
		// (_: number, ...args: any[]) => fn.handler(...args),
		// { arity: -1 }
		// );

		this.sqlite3.create_function(
			this.db,
			fn.name,
			-1,
			0,
			0,
			(_: number, ...args: any[]) => fn.handler(...args)
		);
	};

	// protected importDb = async (message: ImportMessage) => {
	// if (!this.sqlite3 || !this.config.databasePath) return;

	// const { queryKey, database } = message;

	// if (!('opfs' in this.sqlite3)) {
	// this.emitMessage({
	// type: 'error',
	// error: new Error(
	// 'The origin private file system is not available, so a database cannot be imported. Make sure your web server is configured to use the correct HTTP response headers (See https://sqlocal.dallashoffman.com/guide/setup#cross-origin-isolation).'
	// ),
	// queryKey,
	// });
	// return;
	// }

	// try {
	// await this.sqlite3.oo1.OpfsDb.importDb(
	// this.config.databasePath,
	// database
	// );
	// this.emitMessage({
	// type: 'success',
	// queryKey,
	// });
	// } catch (error) {
	// this.emitMessage({
	// type: 'error',
	// error,
	// queryKey,
	// });
	// }
	// };

	protected flushQueue = () => {
		while (this.queuedMessages.length > 0) {
			const message = this.queuedMessages.shift();
			if (message === undefined) continue;
			this.postMessage(message);
		}
	};

	protected destroy = (message: DestroyMessage) => {
		if (!this.db) return;
		if (!this.sqlite3) return;
		this.sqlite3.close(this.db);
		this.db = undefined;
		this.sqlite3 = undefined;

		this.emitMessage({
			type: 'success',
			queryKey: message.queryKey,
		});
	};
}
