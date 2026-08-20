import { describe, expect, test, vi } from 'vitest';

import {
  ChannelView,
  mergeChannelViews,
  resolveChannelView,
} from './channelViews';
import { DraftInputRendererComponent } from './componentsKits';

const REGISTERED = 'registered-component';
const FALLBACK = 'fallback-component';

describe('resolveChannelView', () => {
  test('resolves a registered view', () => {
    expect(
      resolveChannelView({
        declaredId: 'tlon.r0.input.chat',
        registry: { 'tlon.r0.input.chat': REGISTERED },
        fallback: FALLBACK,
      })
    ).toEqual({
      component: REGISTERED,
      resolved: true,
      declaredId: 'tlon.r0.input.chat',
    });
  });

  test('an unregistered view falls back and reports unresolved', () => {
    expect(
      resolveChannelView({
        declaredId: 'tlon.r0.view.mealPlan',
        registry: { 'tlon.r0.input.chat': REGISTERED },
        fallback: FALLBACK,
      })
    ).toEqual({
      component: FALLBACK,
      resolved: false,
      declaredId: 'tlon.r0.view.mealPlan',
    });
  });

  test('an unregistered view with no fallback yields no component', () => {
    expect(
      resolveChannelView({
        declaredId: 'tlon.r0.view.mealPlan',
        registry: {},
      })
    ).toEqual({
      component: null,
      resolved: false,
      declaredId: 'tlon.r0.view.mealPlan',
    });
  });

  // The distinction the render sites depend on: no declaration is the normal
  // path to the channel-type default, not a degradation, so it must not read
  // as unresolved or every legacy channel would show the upgrade notice.
  test.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
  ])('%s declares nothing and resolves to the fallback', (_label, declared) => {
    expect(
      resolveChannelView({
        declaredId: declared,
        registry: { 'tlon.r0.input.chat': REGISTERED },
        fallback: FALLBACK,
      })
    ).toEqual({ component: FALLBACK, resolved: true, declaredId: null });
  });

  test('a registry entry explicitly set to undefined counts as unregistered', () => {
    const { resolved, component } = resolveChannelView<string>({
      declaredId: 'tlon.r0.view.mealPlan',
      registry: { 'tlon.r0.view.mealPlan': undefined },
      fallback: FALLBACK,
    });
    expect(resolved).toBe(false);
    expect(component).toEqual(FALLBACK);
  });
});

describe('mergeChannelViews', () => {
  const BuiltinInput: DraftInputRendererComponent = () => null;
  const RegisteredInput: DraftInputRendererComponent = () => null;

  function view(overrides: Partial<ChannelView>): ChannelView {
    return {
      id: 'tlon.r0.view.mealPlan',
      displayName: 'Meal plan',
      ...overrides,
    };
  }

  function mergeInputs(views: ChannelView[], onCollision = vi.fn()) {
    return {
      merged: mergeChannelViews({
        builtins: { 'tlon.r0.input.chat': BuiltinInput },
        views,
        slot: (v) => v.input,
        onCollision,
      }),
      onCollision,
    };
  }

  test('registers a view under its own id', () => {
    const { merged, onCollision } = mergeInputs([
      view({ input: RegisteredInput }),
    ]);

    expect(merged['tlon.r0.view.mealPlan']).toBe(RegisteredInput);
    expect(merged['tlon.r0.input.chat']).toBe(BuiltinInput);
    expect(onCollision).not.toHaveBeenCalled();
  });

  test('a view that fills no slot registers nothing', () => {
    const { merged } = mergeInputs([view({})]);
    expect(Object.keys(merged)).toEqual(['tlon.r0.input.chat']);
  });

  // A registered view must not be able to take the composer out from under
  // every conversation in the app.
  test('a built-in wins a collision, and the collision is reported', () => {
    const { merged, onCollision } = mergeInputs([
      view({ id: 'tlon.r0.input.chat', input: RegisteredInput }),
    ]);

    expect(merged['tlon.r0.input.chat']).toBe(BuiltinInput);
    expect(onCollision).toHaveBeenCalledWith('tlon.r0.input.chat');
  });

  test('does not mutate the built-ins it merges over', () => {
    const builtins = { 'tlon.r0.input.chat': BuiltinInput };
    mergeChannelViews({
      builtins,
      views: [view({ input: RegisteredInput })],
      slot: (v) => v.input,
      onCollision: vi.fn(),
    });

    expect(Object.keys(builtins)).toEqual(['tlon.r0.input.chat']);
  });
});
