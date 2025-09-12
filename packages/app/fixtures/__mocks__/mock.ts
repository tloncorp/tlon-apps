export type MockedFunction<Fn extends (...args: any[]) => any> = {
  (...args: Parameters<Fn>): ReturnType<Fn>;

  mock: {
    // takes precedence over `implementation`
    implementationWhen: (
      predicate: (...args: Parameters<Fn>) => boolean,
      fn: Fn
    ) => { remove: () => void };
    implementation: (fn: Fn) => void;
    reset: () => void;
    wrapped: Fn;
  };
};

export function createMockedFunction<Fn extends (...args: any[]) => any>(
  originalFn?: Fn
): MockedFunction<Fn> {
  // @ts-expect-error - This is fine; we want to throw (i.e. return `never`) if not implemented
  const defaultFn: Fn = () => {
    // We commonly call these mocks in a useQuery, which will not re-raise an
    // error from the queryFn - to make this visible, use `console.error`.
    console.error('Mocked function called without implementation');

    throw new Error('Mocked function called without implementation');
  };

  const wrapped = originalFn ?? defaultFn;
  let mockImplementation: Fn | null = null;
  const mockImplementationsWithPredicates: Set<{
    predicate: (...args: Parameters<Fn>) => boolean;
    fn: Fn;
  }> = new Set();

  const mockedFn = ((...args: Parameters<Fn>): ReturnType<Fn> => {
    for (const { predicate, fn } of mockImplementationsWithPredicates) {
      if (predicate(...args)) {
        return fn(...args);
      }
    }
    if (mockImplementation) {
      return mockImplementation(...args);
    }
    return wrapped(...args);
  }) as MockedFunction<Fn>;

  mockedFn.mock = {
    implementationWhen: (predicate, fn) => {
      const item = { predicate, fn };
      mockImplementationsWithPredicates.add(item);
      return { remove: () => mockImplementationsWithPredicates.delete(item) };
    },
    implementation: (fn: Fn) => {
      mockImplementation = fn;
    },
    reset: () => {
      mockImplementation = null;
      mockImplementationsWithPredicates.clear();
    },
    wrapped,
  };

  return mockedFn;
}
