import {
  Handler,
  Message,
  Poke,
  PokeHandler,
  ScryHandler,
  SubscriptionHandler,
  SubscriptionRequestInterface,
  UrbitResponse,
} from '@tloncorp/mock-http-api';
import { dateToDa, decToUd, unixToDa } from '@urbit/api';
import chatWrits from '../mocks/mockWrits';
import { ChatDiff } from '../types/chat';

function createResponse<Action, Response>(
  req: Message & (Poke<Action> | SubscriptionRequestInterface),
  data?: Response
): UrbitResponse<Response> {
  return {
    ok: true,
    id: req.id || 0,
    response: req.action as 'poke' | 'subscribe',
    json: data || req.json,
  };
}

const chatSub = {
  action: 'subscribe',
  app: 'chat',
  path: `/chat/~zod/test/ui`,
} as SubscriptionHandler;

const mockHandlers: Handler[] = [
  {
    action: 'scry',
    app: 'chat',
    path: '/chat/~zod/test/writs/newest/100',
    func: () => chatWrits,
  } as ScryHandler,
  chatSub,
  {
    action: 'poke',
    app: 'chat',
    mark: 'chat-action',
    returnSubscription: chatSub,
    dataResponder: (req: Poke<{ time: string; diff: ChatDiff }>) => ({
      id: req.id,
      ok: true,
      response: 'diff',
      json: {
        ...req.json.update,
        time: decToUd(unixToDa(Date.now() * 1000).toString()),
      },
    }),
  } as PokeHandler,
];

export default mockHandlers;
