import * as React from 'react';

export const IntersectionObserverContext = React.createContext<{
  intersectingSetRef: { current: Set<Element> };
  observe: (e: Element) => { unobserve: () => void };
  setRoot: (e: Element | null) => void;
}>({
  intersectingSetRef: { current: new Set() },
  observe: () => {
    console.warn('Use an IntersectionObserverContext');
    return { unobserve: () => {} };
  },
  setRoot: () => {
    console.warn('Use an IntersectionObserverContext');
  },
});

export function IntersectionObserverProvider({
  children,
}: React.PropsWithChildren<object>) {
  const [root, setRoot] = React.useState<Element | null>(null);
  const { observe, intersectingSetRef } = useCollectionIntersectionTracking({
    root,
  });

  return (
    <IntersectionObserverContext.Provider
      value={{ setRoot, observe, intersectingSetRef }}
    >
      {children}
    </IntersectionObserverContext.Provider>
  );
}

export function useIntersectionObserverContext() {
  return React.useContext(IntersectionObserverContext);
}

export function useCollectionIntersectionTracking({
  root,
}: {
  root: Element | null;
}) {
  const intersectingSetRef = React.useRef<Set<Element>>(new Set());
  const observedSet = React.useRef<Set<Element>>(new Set());
  const intersectionObserver = React.useMemo(
    () =>
      new IntersectionObserver(
        (entries) => {
          const next = intersectingSetRef.current;
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              next.add(entry.target);
            } else {
              next.delete(entry.target);
            }
          });
        },
        { root }
      ),
    [root]
  );

  React.useEffect(() => {
    observedSet.current.forEach((x) => intersectionObserver.observe(x));
    return () => {
      intersectionObserver.disconnect();
    };
  }, [intersectionObserver]);

  return {
    observe: React.useCallback(
      (element: Element) => {
        intersectionObserver.observe(element);
        observedSet.current.add(element);
        return {
          unobserve: () => {
            intersectionObserver.unobserve(element);
            observedSet.current.delete(element);
            if (intersectingSetRef.current.has(element)) {
              intersectingSetRef.current.delete(element);
            }
          },
        };
      },
      [intersectionObserver]
    ),
    intersectingSetRef,
  };
}
