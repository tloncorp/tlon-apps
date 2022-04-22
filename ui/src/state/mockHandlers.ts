import { Handler } from '@tloncorp/mock-http-api';
import chatWrits from '../mocks/mockWrits';

const mockHandlers: Handler[] = [
  {
    app: 'chat',
    path: '/chat/~zod/test/writs/newest/100',
    func: () => chatWrits,
  },
  {
    action: 'subscribe',
    app: 'chat',
    path: `/chat/~zod/test/ui`,
    func: () => Promise.resolve(1)
  }
];

export default mockHandlers;
