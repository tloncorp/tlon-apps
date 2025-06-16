import * as React from 'react';

export const IntersectionObserverContext = React.createContext<{
  intersectingSet: Set<Element>;
  observe: (e: Element) => { unobserve: () => void };
  setRoot: (e: Element | null) => void;
}>({
  intersectingSet: new Set(),
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
  const { observe, intersectingSet } = useCollectionIntersectionTracking({
    root,
  });

  return (
    <IntersectionObserverContext.Provider
      value={{ setRoot, observe, intersectingSet }}
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
  const [intersectingSet, setIntersectingSet] = React.useState<Set<Element>>(
    new Set()
  );
  const observedSet = React.useRef<Set<Element>>(new Set());
  const intersectionObserver = React.useMemo(
    () =>
      new IntersectionObserver(
        (entries) => {
          setIntersectingSet((prev) => {
            const next = new Set(prev);
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                next.add(entry.target);
              } else {
                next.delete(entry.target);
              }
            });
            return next;
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
    observe: (element: Element) => {
      intersectionObserver.observe(element);
      observedSet.current.add(element);
      return {
        unobserve: () => {
          intersectionObserver.unobserve(element);
          observedSet.current.delete(element);
          setIntersectingSet((prev) => {
            let out = prev;
            if (prev.has(element)) {
              out = new Set(prev);
              out.delete(element);
            }
            return out;
          });
        },
      };
    },
    intersectingSet,
  };
}
