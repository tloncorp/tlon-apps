export interface RecordStatusEvent {
  status: {
    type: 'twitter' | 'phone';
    value: string;

    status: 'want' | 'wait' | 'done' | 'gone';
    why: string;
  };
}
