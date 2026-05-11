import { poke } from './urbit';

export const A2UI_ACTION_APP = 'a2ui';
export const A2UI_ACTION_MARK = 'a2ui-action';

export type A2UIActionSource = {
  postId?: string;
  channelId?: string;
  authorId?: string;
  actionHostShip?: string;
};

export type A2UIUserAction = {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string;
  context: Record<string, unknown>;
};

export type A2UIUserActionEnvelope = {
  userAction: A2UIUserAction;
};

export type A2UIActionPokePayload = A2UIUserActionEnvelope & {
  tlonContext?: A2UIActionSource;
};

export async function submitA2UIUserAction({
  envelope,
  source,
}: {
  envelope: A2UIUserActionEnvelope;
  source?: A2UIActionSource;
}) {
  const json: A2UIActionPokePayload = {
    ...envelope,
    ...(source ? { tlonContext: source } : {}),
  };
  const actionHostShip = source?.actionHostShip || source?.authorId;

  console.info('[a2ui] submit userAction', {
    actionHostShip,
    name: envelope.userAction.name,
    sourceComponentId: envelope.userAction.sourceComponentId,
    surfaceId: envelope.userAction.surfaceId,
    source,
  });

  return poke({
    ...(actionHostShip ? { ship: actionHostShip } : {}),
    app: A2UI_ACTION_APP,
    mark: A2UI_ACTION_MARK,
    json,
  });
}
