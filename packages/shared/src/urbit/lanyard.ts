export type LanyardRecords = LanyardRecord[];

export type LanyardRecord =
  | LanyardPhoneRecord
  | LanyardNodeRecord
  | LanyardDummyRecord;

export type LanyardRecordIdentifier =
  | { phone: string }
  | { urbit: string }
  | { dummy: string };

export interface LanyardPhoneRecord {
  identifier: { phone: string };
  record: LanyardRecordValue;
}

export interface LanyardNodeRecord {
  identifier: { urbit: string };
  record: LanyardRecordValue;
}

export interface LanyardDummyRecord {
  identifier: { dummy: string };
  record: LanyardRecordValue;
}

export interface LanyardRecordValue {
  start: string;
  state: LanyardRecordState;
}

export interface LanyardRecordState {
  config: LanyardRecordConfig;
  status: LanyardRecordStatus;
}

export type LanyardRecordConfig = 'public' | 'hidden' | 'verified';
export type LanyardRecordStatus = 'done' | 'wait' | 'want';

export function isPhoneRecord(
  record: LanyardRecord
): record is LanyardPhoneRecord {
  return 'phone' in record.identifier;
}

export function isNodeRecord(
  record: LanyardRecord
): record is LanyardNodeRecord {
  return 'urbit' in record.identifier;
}

export function isDummyRecord(
  record: LanyardRecord
): record is LanyardDummyRecord {
  return 'dummy' in record.identifier;
}

export interface LanyardCommand {
  host: string | null;
  command: LanyardUserCommand;
}

export type LanyardUserCommand = LanyardStartCommand | LanyardWorkCommand;

export interface LanyardStartCommand {
  start: {
    id: LanyardRecordIdentifier;
  };
}

export interface LanyardWorkCommand {
  work: {
    id: LanyardRecordIdentifier;
    work: LanyardUserWork;
  };
}

export type LanyardUserWork =
  | { urbit: { pin: string } }
  | { phone: { otp: string } };
