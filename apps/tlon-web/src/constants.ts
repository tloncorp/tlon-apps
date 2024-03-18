// eslint-disable-next-line import/prefer-default-export
export const STANDARD_MESSAGE_FETCH_PAGE_SIZE = 100;
export const LARGE_MESSAGE_FETCH_PAGE_SIZE = 300;
export const FETCH_BATCH_SIZE = 3;
export const MAX_DISPLAYED_OPTIONS = 40;
export const NOTE_REF_DISPLAY_LIMIT = 600;
export const LEAP_DESCRIPTION_TRUNCATE_LENGTH = 48;
export const LEAP_RESULT_TRUNCATE_SIZE = 5;
export const LEAP_RESULT_SCORE_THRESHOLD = 10;
export const CURIO_PAGE_SIZE = 250;
export const CHANNEL_SEARCH_RESULT_SIZE = 20;

export const PASTEABLE_MEDIA_TYPES = [
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/svg',
  'image/tif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
];

export const AUTHORS = [
  '~nocsyx-lassul',
  '~finned-palmer',
  '~hastuc-dibtux',
  '~datder-sonnet',
  '~rilfun-lidlen',
  '~ravmel-ropdyl',
  '~fabled-faster',
  '~fallyn-balfus',
  '~riprud-tidmel',
  '~wicdev-wisryt',
  '~rovnys-ricfer',
  '~mister-dister-dozzod-dozzod',
];

export const lsDesk = 'landscape';

export const ALPHABETICAL_SORT = 'A → Z';
export const DEFAULT_SORT = 'Arranged';
export const RECENT_SORT = 'Recent';

export type SortMode =
  | typeof ALPHABETICAL_SORT
  | typeof DEFAULT_SORT
  | typeof RECENT_SORT;
