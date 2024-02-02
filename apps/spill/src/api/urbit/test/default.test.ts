import Urbit from '../src';
import 'jest';

function fakeSSE(messages: any[] = [], timeout = 0) {
  const ourMessages = [...messages];
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        let message = ':\n';
        if (ourMessages.length > 0) {
          message = ourMessages.shift();
        }

        controller.enqueue(enc.encode(message));
      }, 50);

      if (timeout > 0) {
        setTimeout(() => {
          controller.close();
          clearInterval(interval);
          interval;
        }, timeout);
      }
    },
  });
}

const ship = '~sampel-palnet';
function newUrbit(): Urbit {
  let airlock = new Urbit('', '+code');
  //NOTE  in a real environment, these get populated at the end of connect()
  airlock.ship = airlock.our = ship.substring(1);
  return airlock;
}

let eventId = 0;
function event(data: any) {
  return `id:${eventId++}\ndata:${JSON.stringify(data)}\n\n`;
}

function fact(id: number, data: any) {
  return event({
    response: 'diff',
    id,
    json: data,
  });
}

function ack(id: number, err = false) {
  const res = err ? { err: 'Error' } : { ok: true };
  return event({ id, response: 'poke', ...res });
}
const fakeFetch = (body: Function) => () =>
  Promise.resolve({
    ok: true,
    body: body(),
  });

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

process.on('unhandledRejection', (error) => {
  console.error(error);
});

describe('Initialisation', () => {
  let airlock: Urbit;
  let fetchSpy: ReturnType<typeof jest.spyOn>;
  beforeEach(() => {
    airlock = newUrbit();
  });
  afterEach(() => {
    fetchSpy.mockReset();
  });
  it('should poke & connect upon a 200', async () => {
    airlock.onOpen = jest.fn();
    fetchSpy = jest.spyOn(window, 'fetch');
    fetchSpy
      .mockImplementationOnce(() =>
        Promise.resolve({ ok: true, body: fakeSSE() } as Response)
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ ok: true, body: fakeSSE([ack(1)]) } as Response)
      );
    await airlock.eventSource();

    expect(airlock.onOpen).toHaveBeenCalled();
  }, 500);
  it('should handle failures', async () => {
    fetchSpy = jest.spyOn(window, 'fetch');
    airlock.onRetry = jest.fn();
    airlock.onOpen = jest.fn();
    fetchSpy
      .mockImplementationOnce(() =>
        Promise.resolve({ ok: true, body: fakeSSE() } as Response)
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ ok: true, body: fakeSSE([], 100) } as Response)
      );

    airlock.onError = jest.fn();
    try {
      airlock.eventSource();
      await wait(200);
    } catch (e) {
      expect(airlock.onRetry).toHaveBeenCalled();
    }
  }, 300);
});

describe('subscription', () => {
  let airlock: Urbit;
  let fetchSpy: jest.SpyInstance;
  beforeEach(() => {
    eventId = 1;
  });
  afterEach(() => {
    fetchSpy.mockReset();
  });

  it('should subscribe', async () => {
    fetchSpy = jest.spyOn(window, 'fetch');
    airlock = newUrbit();
    airlock.onOpen = jest.fn();
    const params = {
      app: 'app',
      path: '/path',
      err: jest.fn(),
      event: jest.fn(),
      quit: jest.fn(),
    };
    const firstEv = 'one';
    const secondEv = 'two';
    const events = (id: number) => [fact(id, firstEv), fact(id, secondEv)];
    fetchSpy.mockImplementation(fakeFetch(() => fakeSSE(events(1))));

    await airlock.subscribe(params);
    await wait(600);

    expect(airlock.onOpen).toBeCalled();
    expect(params.event).toHaveBeenNthCalledWith(1, firstEv, 'json', 1);
    expect(params.event).toHaveBeenNthCalledWith(2, secondEv, 'json', 1);
  }, 800);
  it('should handle poke acks', async () => {
    fetchSpy = jest.spyOn(window, 'fetch');
    airlock = newUrbit();
    airlock.onOpen = jest.fn();
    fetchSpy.mockImplementation(fakeFetch(() => fakeSSE([ack(1)])));
    const params = {
      app: 'app',
      mark: 'mark',
      json: { poke: 1 },
      onSuccess: jest.fn(),
      onError: jest.fn(),
    };
    await airlock.poke(params);
    await wait(300);
    expect(params.onSuccess).toHaveBeenCalled();
  }, 800);

  it('should handle poke nacks', async () => {
    fetchSpy = jest.spyOn(window, 'fetch');
    airlock = newUrbit();
    airlock.onOpen = jest.fn();
    fetchSpy
      .mockImplementationOnce(fakeFetch(() => fakeSSE()))
      .mockImplementationOnce(fakeFetch(() => fakeSSE([ack(1, true)])));

    const params = {
      app: 'app',
      mark: 'mark',
      json: { poke: 1 },
      onSuccess: jest.fn(),
      onError: jest.fn(),
    };
    await airlock.poke(params);
    await wait(300);
    expect(params.onError).toHaveBeenCalled();
  }, 800);
});
