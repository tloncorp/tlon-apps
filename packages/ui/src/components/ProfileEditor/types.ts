export interface GridMeasure {
  x: number;
  y: number;
  cellSize: number;
  borderWidth: number;
  numRows: number;
  numCols: number;
}

export interface WidgetPosition {
  rowStart: number;
  colStart: number;
  numRows: number;
  numCols: number;
  layer: number;
}

export interface ProfileData {
  nickname?: string;
  patp: string;
  avatar?: string;
  bio: string;
}

export interface WidgetInstance {
  id: string;
  title: string;
  typeId: WidgetId;
  data: any;

  position: WidgetPosition;
}

type WidgetId =
  | 'tlon:gallery'
  | 'tlon:notebook'
  | 'tlon:attestation'
  | 'tlon:guestbook'
  | 'tlon:profile';
