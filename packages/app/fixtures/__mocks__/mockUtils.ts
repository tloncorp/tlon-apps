import * as ub from '@tloncorp/shared/api';
import { MockedFunction } from '@tloncorp/shared/utils';
import { useEffect } from 'react';

export function useMockImplementation<M extends MockedFunction<any>>(
  m: M,
  impl: M extends MockedFunction<infer F> ? F : never
) {
  useEffect(() => {
    m.mock.implementation(impl);
    return () => {
      m.mock.reset();
    };
  }, [m, impl]);
}

export function useMockScry(
  app: string,
  path: string,
  buildResponse: () => Promise<unknown>
) {
  useEffect(() => {
    const scry = MockedFunction.cast(ub.scry);
    scry.mock.enabled = true;

    const impl = scry.mock.implementationWhen(
      ({ app: a, path: p }) => a === app && p === path,
      // @ts-expect-error - `scry` is asserting a type that can't be verified - `unknown` is accurate
      buildResponse
    );
    return () => impl.remove();
  }, [app, path, buildResponse]);
}
