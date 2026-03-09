import { poke } from '@tloncorp/api';
import type { PostBlobDataEntryActionButton } from '@tloncorp/api/lib/content-helpers';

export async function fireActionButtonPoke(
  actionButton: PostBlobDataEntryActionButton,
  pokeFn: typeof poke = poke
) {
  await pokeFn({
    app: actionButton.pokeApp,
    mark: actionButton.pokeMark,
    json: actionButton.pokeJson,
  });
}

export function actionButtonErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return `Failed to send action: ${error.message}`;
  }

  return 'Failed to send action. Please try again.';
}
