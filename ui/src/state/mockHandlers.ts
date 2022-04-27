import {
  Handler,
  Message,
  Poke,
  PokeHandler,
  ScryHandler,
  SubscriptionHandler,
} from '@tloncorp/mock-http-api';
import { decToUd, unixToDa } from '@urbit/api';
import chatWrits from '../mocks/mockWrits';
import { ChatDiff } from '../types/chat';

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
    dataResponder: (
      req: Message &
        Poke<{ flag: string; update: { time: string; diff: ChatDiff } }>
    ) => ({
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
