import { GroupMeta } from './groups';

/**
 * Either a `@p` or a `$flag` rendered as string
 */
export type ChatWhom = string;

/**
 * A Club is the backend terminology for Multi DMs
 */
export interface Club {
  hive: string[];
  team: string[];
  meta: GroupMeta;
}
