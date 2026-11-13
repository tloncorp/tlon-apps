import { getDurableClient } from '@tloncorp/api/client/durable';

// Publishing puts a note on the ship's public web pages. The local backend
// keeps a notebook inside its group and has nowhere to publish it.
export function backendPublishesNotes(): boolean {
  return !getDurableClient();
}
