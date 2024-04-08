// From https://github.com/iolyd/drizzle-orm-helpers/blob/e5270c822b6e0c4ede02daad3c3c647a65652686/src/utilities.ts
import {
  type AnyColumn,
  Column,
  type ColumnBuilderBase,
  type ColumnsSelection,
  type InferSelectModel,
  Placeholder,
  SQL,
  type SQLWrapper,
  Subquery,
  SubqueryConfig,
  Table,
  View,
  ViewBaseConfig,
  type WithSubquery,
  is,
} from 'drizzle-orm';
import type {
  AnyMySqlSelect,
  MySqlSchema,
  MySqlSelect,
  SubqueryWithSelection as MySqlSubqueryWithSelection,
  WithSubqueryWithSelection as MySqlWithSubqueryWithSelection,
} from 'drizzle-orm/mysql-core';
import type {
  AnyPgSelect,
  PgSchema,
  PgSelect,
  SubqueryWithSelection as PgSubqueryWithSelection,
  WithSubqueryWithSelection as PgWithSubqueryWithSelection,
} from 'drizzle-orm/pg-core';
import type {
  AnySQLiteSelect,
  SQLiteSelect,
  SubqueryWithSelection as SQLiteSubqueryWithSelection,
  WithSubqueryWithSelection as SQLiteWithSubqueryWithSelection,
} from 'drizzle-orm/sqlite-core';
import type { SetOptional } from 'type-fest';

/**
 * Dialect agnostic select.
 *
 * @see PgSelect.
 * @see MySqlSelect
 * @see SQLiteSelect
 */
export type Select = SetOptional<
  PgSelect | MySqlSelect | SQLiteSelect,
  'where'
>;

/**
 * Dialect-agnostic schema. Excludes SQLite.
 */
export type Schema = PgSchema | MySqlSchema;

/**
 * Dialect-agnostic subquery with selection.
 */
export type SubqueryWithSelection<
  TSelection extends ColumnsSelection,
  TName extends string,
> =
  | MySqlSubqueryWithSelection<TSelection, TName>
  | PgSubqueryWithSelection<TSelection, TName>
  | SQLiteSubqueryWithSelection<TSelection, TName>;

/**
 * Dialect-agnostic with subquery with selection.
 */
export type WithSubqueryWithSelection<
  TSelection extends ColumnsSelection,
  TAlias extends string,
> =
  | PgWithSubqueryWithSelection<TSelection, TAlias>
  | SQLiteWithSubqueryWithSelection<TSelection, TAlias>
  | MySqlWithSubqueryWithSelection<TSelection, TAlias>;

/**
 * Dialect agnostic AnySelect.
 *
 * @see AnyPgSelect
 * @see AnyMySqlSelect
 * @see AnySQLiteSelect
 */
export type AnySelect = SetOptional<
  AnyPgSelect | AnyMySqlSelect | AnySQLiteSelect,
  'where'
>;

/**
 * Infer type of table column.
 */
export type InferColumnType<
  T extends (...config: never[]) => ColumnBuilderBase,
> = AnyColumn<Pick<ReturnType<T>['_'], 'data' | 'dataType'>>;

/**
 * Infer any SQL wrapper's expected return data type.
 */
export type InferData<T extends SQLWrapper> = T extends Table
  ? InferSelectModel<T>
  : T extends Column
    ? T['_']['notNull'] extends true
      ? T['_']['data']
      : T['_']['data'] | null
    : T extends View | Subquery
      ? T['_']['selectedFields']
      : T extends SQL<infer U>
        ? U
        : T extends SQL.Aliased<infer U>
          ? U
          : unknown;

/**
 * Infer table columns or (sub)query fields.
 */
export type InferColumns<
  T extends
    | Table
    | View
    | Subquery<string, ColumnsSelection>
    | WithSubquery<string, ColumnsSelection>
    | AnySelect,
> = T extends Table
  ? T['_']['columns']
  : T extends View | Subquery | WithSubquery | AnySelect
    ? T['_']['selectedFields']
    : never;

/**
 * Infer a table's name or a (sub)query's alias.
 */
export type InferNameOrAlias<T extends SQLWrapper> = T extends
  | Table
  | View
  | Column
  ? T['_']['name']
  : T extends Subquery | WithSubquery
    ? T['_']['alias']
    : T extends AnySelect
      ? T['_']['tableName']
      : T extends SQL.Aliased
        ? T['fieldAlias']
        : T extends Placeholder
          ? T['name']
          : undefined;

/**
 * Should replace `getTableColumns` to allow for more input versatility.
 *
 * @see https://github.com/drizzle-team/drizzle-orm/pull/1789
 */
export function getColumns<
  T extends
    | Table
    | View
    | Subquery<string, ColumnsSelection>
    | WithSubquery<string, ColumnsSelection>
    | AnySelect,
>(table: T): InferColumns<T> {
  console.log('GET COLUMNS', table);
  return is(table, Table)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (table as any)[(Table as any).Symbol.Columns]
    : is(table, View)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (table as any)[ViewBaseConfig].selectedFields
      : is(table, Subquery)
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (table as any)[SubqueryConfig].selection
        : // is(table, WithSubquery) ?
          // (table as any)[SubqueryConfig].selectedFields :
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (table as any)._.selectedFields;
}

/**
 * Get a table's name or a (sub)query's alias.
 */
export function getNameOrAlias<T extends SQLWrapper>(
  query: T
): InferNameOrAlias<T> {
  return is(query, Table)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (query as any)[(Table as any).Symbol.Name]
    : is(query, View)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (query as any)[ViewBaseConfig].name
      : is(query, Column)
        ? query.name
        : is(query, Subquery)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (query as any)[SubqueryConfig].alias
          : is(query, SQL.Aliased)
            ? query.fieldAlias
            : is(query, Placeholder)
              ? query.name
              : undefined;
}

/**
 * Paginate a query.
 */
export function paginate<T extends Select>(
  qb: T,
  { page, size = 20 }: { page: number; size?: number }
) {
  return qb.limit(size).offset(page * size);
}
