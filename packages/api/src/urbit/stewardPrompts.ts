/** Last observed workspace contents, keyed by ship and filename. */
export type StewardPromptFiles = Record<string, Record<string, string>>;
export type StewardPromptEdit = { set: { name: string; text: string } };
export type StewardPromptErrorType =
  | 'not-authorized'
  | 'not-found'
  | 'invalid'
  | 'harness-offline'
  | 'harness-error'
  | 'unknown';
export type StewardPromptResponseBody =
  | { type: 'updated'; name: string }
  | { type: 'error'; errorType: StewardPromptErrorType; message: string[] }
  | { type: 'pending'; status: 'sending' | 'acked' | 'nacked' };
export interface StewardPromptResponse {
  requestId: string;
  body: StewardPromptResponseBody;
}
export type StewardPromptUpdate =
  | { files: StewardPromptFiles }
  | { set: { ship: string; name: string; text: string } }
  | { del: { ship: string; name: string } }
  | { gone: { ship: string } };
