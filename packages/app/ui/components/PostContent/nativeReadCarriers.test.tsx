import React, { Suspense, createRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  BlockData,
  ImageBlockData,
  ParagraphBlockData,
} from '@tloncorp/shared/logic';
import type { Post } from '@tloncorp/shared/db';
import { Platform } from 'react-native';
import { Pressable } from '@tloncorp/ui';
import { NativeReadImageFrame } from './nativeReadFrame';
import { View as TamaguiView } from 'tamagui';
import {
  NativeReadListContext,
  NativeReadRowContext,
} from '../../contexts/nativeRead';
import {
  NativeReadScopeContainer,
  NativeReadItemContainer,
} from '../ScrollReadContainers.ios';
import { ScrollerItem } from '../Channel/ScrollerItem';
import {
  emptyReadMembership,
  reconcileReadMembership,
} from '../Channel/PostList/nativeReadMetadata';
import { createContentRenderer, PostContentRenderer } from './ContentRenderer';
import { IsInsideReferenceContext } from './BlockRenderer';

const nativePressOwnership = vi.hoisted(() => ({ active: false }));

vi.mock('react-native', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const { createRequire } =
    await vi.importActual<typeof import('node:module')>('node:module');
  const { resolve, dirname, join } =
    await vi.importActual<typeof import('node:path')>('node:path');
  const { readFileSync } =
    await vi.importActual<typeof import('node:fs')>('node:fs');
  const vm = await vi.importActual<typeof import('node:vm')>('node:vm');
  const require = createRequire(resolve('package.json'));
  const { transformSync } = require('@babel/core');
  const root = dirname(require.resolve('react-native/package.json'));
  const compile = (relative: string, imports: Record<string, unknown>) => {
    const source = readFileSync(join(root, relative), 'utf8');
    const code = transformSync(source, {
      filename: relative,
      babelrc: false,
      configFile: false,
      plugins: [
        require.resolve('babel-plugin-syntax-hermes-parser'),
        require.resolve('@babel/plugin-transform-flow-strip-types'),
        require.resolve('@babel/plugin-transform-modules-commonjs'),
      ],
    }).code;
    const module = { exports: {} };
    vm.runInNewContext(code, {
      module,
      process: { env: { NODE_ENV: 'production' } },
      exports: module.exports,
      __DEV__: false,
      setTimeout: (callback: () => void, delay: number) =>
        setTimeout(callback, delay),
      clearTimeout: (timer: ReturnType<typeof setTimeout>) =>
        clearTimeout(timer),
      Date: { now: () => Date.now() },
      require: (name: string) => {
        if (!(name in imports))
          throw Error(`Unexpected native press dependency: ${name}`);
        return imports[name];
      },
    });
    return module.exports as { default: unknown };
  };
  const Platform = { OS: 'ios' };
  const pressability = compile('Libraries/Pressability/Pressability.js', {
    '../../src/private/featureflags/ReactNativeFeatureFlags': {
      shouldPressibilityUseW3CPointerEventsForHover: () => false,
      shouldEmitW3CPointerEvents: () => false,
    },
    '../Components/Sound/SoundManager': { playTouchSound: () => {} },
    '../ReactNative/UIManager': {
      measure: (_target: unknown, callback: (...values: number[]) => void) =>
        callback(0, 0, 200, 100, 0, 0),
    },
    '../StyleSheet/Rect': {
      normalizeRect: (value: unknown) =>
        typeof value === 'number'
          ? { top: value, left: value, right: value, bottom: value }
          : value,
    },
    '../Utilities/Platform': Platform,
    './HoverState': { isHoverEnabled: () => false },
    './PressabilityPerformanceEventEmitter.js': { emitEvent: () => {} },
    invariant: (condition: unknown, message: string) => {
      if (!condition) throw Error(message);
    },
  });
  const hook = compile('Libraries/Pressability/usePressability.js', {
    './Pressability': pressability,
    react: React,
  });
  return {
    Platform,
    usePressability: hook.default,
    View: 'RNView',
    ActivityIndicator: 'ActivityIndicator',
    Linking: {},
    StyleSheet: { create: (styles: object) => styles },
  };
});
vi.mock('@tamagui/native', () => ({
  unstable_hasExternalPressOwnership: () => nativePressOwnership.active,
}));
vi.mock('expo-modules-core', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    requireNativeViewManager: (module: string, name: string) => {
      if (module !== 'TlonScrollEdgeEffect') throw Error('wrong native module');
      return React.forwardRef((props: object, ref) =>
        React.createElement(`native-${name}`, { ...props, ref })
      );
    },
  };
});
vi.mock('../ScrollReadContainers', async () =>
  vi.importActual('../ScrollReadContainers.ios')
);
vi.mock('tamagui', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const { createRequire } =
    await vi.importActual<typeof import('node:module')>('node:module');
  const { dirname, join, resolve } =
    await vi.importActual<typeof import('node:path')>('node:path');
  const { pathToFileURL } =
    await vi.importActual<typeof import('node:url')>('node:url');
  const require = createRequire(resolve('package.json'));
  const { readFileSync } =
    await vi.importActual<typeof import('node:fs')>('node:fs');
  const vm = await vi.importActual<typeof import('node:vm')>('node:vm');
  const { parse } = require('acorn');
  const core = dirname(require.resolve('@tamagui/core/package.json'));
  const web = dirname(require.resolve('@tamagui/web/package.json'));
  const coreSource = readFileSync(
    join(core, 'dist/cjs/index.native.js'),
    'utf8'
  );
  const componentSource = readFileSync(
    join(web, 'dist/cjs/createComponent.native.js'),
    'utf8'
  );
  const splitSource = readFileSync(
    join(web, 'dist/cjs/helpers/getSplitStyles.native.js'),
    'utf8'
  );
  const defaultsSource = readFileSync(
    join(web, 'dist/cjs/helpers/getDefaultProps.native.js'),
    'utf8'
  );
  const filterStart = splitSource.indexOf('    var keyInit = keyOg2;');
  const filterEnd = splitSource.indexOf(
    '    if (keyInit in import_skipProps.skipProps',
    filterStart
  );
  const defaultsStart = defaultsSource.indexOf(
    'var getDefaultProps = function'
  );
  if (filterStart < 0 || filterEnd <= filterStart || defaultsStart < 0)
    throw Error('Installed native default filtering source changed');
  const optimizedSource = readFileSync(
    join(core, 'dist/cjs/createOptimizedView.native.js'),
    'utf8'
  );
  const nodes: {
    type?: string;
    key?: { name?: string };
    value?: { body: { start: number; end: number } };
  }[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const node = value as (typeof nodes)[number];
    if (node.type) nodes.push(node);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(parse(coreSource, { ecmaVersion: 'latest', sourceType: 'script' }));
  const hooks = nodes.filter(
    (node) => node.type === 'Property' && node.key?.name === 'useChildren'
  );
  if (hooks.length !== 1 || !hooks[0].value)
    throw Error('Native useChildren source missing');
  const body = hooks[0].value.body;
  const hookBody = coreSource.slice(body.start, body.end);
  const start = componentSource.indexOf(
    '      if (import_setupHooks.hooks.useChildren) content ='
  );
  const end = componentSource.indexOf(
    '      if (process.env.NODE_ENV === "development" && time)',
    start
  );
  const customStart = componentSource.indexOf('var getCustomRender = function');
  const optimizedStart = optimizedSource.indexOf(
    'function createOptimizedView('
  );
  if (start < 0 || end <= start || customStart < 0 || optimizedStart < 0)
    throw Error('Native render source changed');
  const { mergeRenderElementProps } = await vi.importActual<{
    mergeRenderElementProps: (
      element: unknown,
      view: unknown,
      children: unknown
    ) => Record<string, unknown>;
  }>(
    pathToFileURL(
      join(web, 'dist/esm/helpers/mergeRenderElementProps.native.js')
    ).href
  );
  const { Slot } = await vi.importActual<{
    Slot: React.ComponentType<Record<string, unknown>>;
  }>(pathToFileURL(join(web, 'dist/esm/views/Slot.native.js')).href);
  const BaseView = () => null;
  const sandbox = {
    import_react: { default: React },
    process: { env: { NODE_ENV: 'production' } },
    baseViews: { View: BaseView, TextAncestor: React.createContext(false) },
    import_mergeRenderElementProps: { mergeRenderElementProps },
    _type_of: (value: unknown) => typeof value,
    import_config: { getConfig: () => ({}) },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    defaultsSource.slice(
      defaultsStart,
      defaultsSource.indexOf('//# sourceMappingURL=')
    ) +
      '\nimport_getDefaultProps={getDefaultProps};\n' +
      'skipDefault=function(props,staticConfig,keyOg2){var viewProps={},accept=null,asChild=props.asChild,disableExpandShorthands=false,shorthands={};\n' +
      splitSource.slice(filterStart, filterEnd) +
      '\nreturn false;};\n' +
      optimizedSource.slice(
        optimizedStart,
        optimizedSource.indexOf('//# sourceMappingURL=')
      ) +
      '\n' +
      componentSource.slice(
        customStart,
        componentSource.indexOf('//# sourceMappingURL=')
      ) +
      '\n' +
      'import_createOptimizedView={createOptimizedView};\n' +
      'import_setupHooks={hooks:{useChildren(elementType,children,viewProps)' +
      hookBody +
      '}};\n' +
      'run=function(elementType,renderProp,children,viewProps){var content,componentState={};\n' +
      componentSource.slice(start, end) +
      '\nreturn content;};',
    sandbox
  );
  const nativeRun = (
    sandbox as typeof sandbox & {
      run: (
        type: unknown,
        render: unknown,
        children: unknown,
        props: object
      ) => React.ReactNode;
    }
  ).run;
  // Actual installed default filtering precedes the production optimization,
  // custom render and Slot bodies. Style token/Yoga resolution remains modeled.
  const skipDefault = (
    sandbox as typeof sandbox & {
      skipDefault: (
        props: Record<string, unknown>,
        config: object,
        key: string
      ) => unknown;
    }
  ).skipDefault;
  const host = (
    name: string,
    config: Record<string, any> = {},
    optimize = true
  ) => {
    const result = React.forwardRef(
      (incoming: Record<string, unknown>, ref) => {
        const all = { ...config.defaultProps, ...incoming };
        const { render, children, asChild } = all;
        const props: Record<string, unknown> = {};
        const style: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(all)) {
          if (['children', 'render', 'asChild', 'style'].includes(key))
            continue;
          if (skipDefault(all, config, key) === 'continue') continue;
          if (
            /^(padding|margin|width|height|maxWidth|maxHeight|minWidth|minHeight|flex|align|overflow|gap|background|border|font|lineHeight|color|textAlign)/.test(
              key
            )
          )
            style[key] = value;
          else props[key] = value;
        }
        const flatten = (value: unknown): Record<string, unknown> =>
          Array.isArray(value)
            ? Object.assign({}, ...value.map(flatten))
            : value && typeof value === 'object'
              ? (value as Record<string, unknown>)
              : {};
        const viewProps = {
          ...props,
          style: { ...style, ...flatten(all.style) },
          ref,
        };
        const native = Platform.OS === 'ios';
        const elementType = asChild
          ? Slot
          : config.Component || (native && optimize ? BaseView : name);
        return nativeRun(elementType, render, children, viewProps);
      }
    );
    return Object.assign(result, {
      staticConfig: config,
      styleable: (render: any) => React.forwardRef(render),
    });
  };
  const View = host('View');
  return {
    isWeb: false,
    withStaticProperties: (component: any, properties: object) =>
      Object.assign(component, properties),
    View,
    YStack: host('YStack', { defaultProps: { flexDirection: 'column' } }),
    XStack: host('XStack', { defaultProps: { flexDirection: 'row' } }),
    ScrollView: host('ScrollView'),
    createComponent: (config: Record<string, any>) =>
      host(config.componentName || 'View', config),
    styled: (
      base: any,
      config: Record<string, unknown>,
      extra: Record<string, unknown> = {}
    ) => {
      const { name, context, variants, ...defaults } = config;
      const parent = base.staticConfig;
      return host(
        typeof name === 'string'
          ? name
          : typeof base === 'string'
            ? base
            : 'Styled',
        {
          ...parent,
          ...extra,
          Component: parent
            ? parent.Component
            : typeof base === 'string'
              ? undefined
              : base,
          componentName: name,
          context,
          variants,
          defaultProps: { ...parent?.defaultProps, ...defaults },
        },
        base !== 'Text' && base !== 'Image'
      );
    },
    createStyledContext: (defaults: Record<string, unknown> = {}) => {
      const context = React.createContext(defaults);
      const Provider = context.Provider;
      Object.defineProperty(context, 'Provider', {
        value: ({ children, ...value }: Record<string, unknown>) =>
          React.createElement(
            Provider,
            { value: { ...defaults, ...value } },
            children as React.ReactNode
          ),
      });
      return context;
    },
  };
});
vi.mock('@tloncorp/ui', async () => {
  const { default: Pressable } = await vi.importActual<{
    default: (typeof import('@tloncorp/ui'))['Pressable'];
  }>('../../../../ui/src/components/Pressable');
  return {
    Text: 'Text',
    Image: 'Image',
    Pressable,
    Icon: 'Icon',
    GestureTrigger: ({ children }: React.PropsWithChildren) => children,
    useCopy: () => ({ doCopy: () => {}, didCopy: false }),
  };
});
vi.mock('@react-navigation/native', () => ({ useLinkProps: () => ({}) }));
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {},
  trackEvent: vi.fn(),
  useMutableCallback: (fn: unknown) => fn,
}));
vi.mock('@tloncorp/shared/logic', () => ({
  convertContent: (content: string) => JSON.parse(content),
}));
vi.mock('@tloncorp/shared/store', () => ({ editPost: vi.fn() }));
vi.mock('../../../hooks/useLivePost', () => ({
  useLivePost: (post: Post) => post,
}));
vi.mock('../Channel/ChannelDivider', () => ({ ChannelDivider: 'Divider' }));
vi.mock('../Channel/usePostTargetLayout', () => ({
  usePostTargetLayout: () => undefined,
}));
vi.mock('../../contexts/channel', () => ({
  useOptionalChannelContext: () => null,
}));
vi.mock('../../contexts/nowPlaying', () => ({
  useNowPlayingController: () => ({}),
}));
vi.mock('react-native-gesture-handler', () => ({
  ScrollView: 'ScrollView',
  Gesture: {},
  GestureDetector: 'GestureDetector',
}));
vi.mock('../AudioRecorder/Waveform', () => ({ Waveform: 'Waveform' }));
vi.mock('../ContentReference/Reference', async () =>
  vi.importActual('../ContentReference/Reference')
);
vi.mock('../FileUploadPreview', () => ({ FileUploadPreview: 'FileUpload' }));
vi.mock('../VideoPreview', () => ({ VideoPreview: 'Video' }));
vi.mock('../HighlightedCode', async () =>
  vi.importActual('../HighlightedCode')
);
vi.mock('./A2UIBlock', () => ({ A2UIBlock: 'A2UI' }));
vi.mock('./BlockquoteSideBorder', () => ({
  BlockquoteSideBorder: 'QuoteBorder',
}));
vi.mock('./InlineRenderer', () => ({
  InlineRenderer: ({ inline }: { inline: { text: string } }) => inline.text,
  InlineRendererProvider: ({ children }: React.PropsWithChildren) => children,
}));

const binding = { version: 1 as const, scope: 'chat/zod/a', visit: 'visit-1' };
const row = { ...binding, key: 'post-a', revision: 'member-1' };
const paragraph = (text: string): ParagraphBlockData => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});
const image = (src: string): ImageBlockData => ({
  type: 'image',
  src,
  alt: 'photo',
  width: 200,
  height: 100,
});
const Render = createContentRenderer({});
let tree: ReactTestRenderer | undefined;
afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  Platform.OS = 'ios';
  vi.useRealTimers();
  nativePressOwnership.active = false;
});
function render(
  content: BlockData[],
  options: { row?: typeof row; renderer?: typeof Render; inside?: boolean } = {}
) {
  const Component = options.renderer ?? Render;
  const element = (
    <NativeReadRowContext.Provider value={options.row ?? row}>
      <IsInsideReferenceContext.Provider value={options.inside ?? false}>
        <Component
          content={content}
          testID="content"
          accessibilityLabel="message"
          paddingBottom={7}
        />
      </IsInsideReferenceContext.Provider>
    </NativeReadRowContext.Provider>
  );
  act(() => {
    if (tree) tree.update(element);
    else tree = create(element);
  });
}
function hosts(kind: string) {
  return tree!.root.findAll(
    (node) => typeof node.type === 'string' && node.type === kind
  );
}
function host(kind: string) {
  const nodes = hosts(kind);
  expect(nodes.length).toBe(1);
  return nodes[0];
}
function textOf(node: import('react-test-renderer').ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : textOf(child)))
    .join('');
}
function carriers() {
  return hosts('native-ScrollReadItemContainer');
}
function descriptors() {
  return carriers()
    .filter((node) => typeof node.props.descriptor === 'string')
    .map((node) => JSON.parse(node.props.descriptor));
}
function rowDescriptor() {
  return descriptors().find((value) => value.kind === 'row');
}
function inner() {
  return descriptors().filter((value) => value.kind !== 'row');
}
function load(url: string, width = 200, height = 100) {
  return {
    source: { url, width, height, mediaType: 'image' },
    cacheType: 'none',
  };
}
function imageNode() {
  return host('ContentImage');
}

describe('default CodeBlock interior native reading', () => {
  const code = {
    type: 'code' as const,
    content: 'const answer = 42;\nreturn answer;',
    lang: 'javascript',
  };
  it('owns code source outside horizontal scrolling and excludes header labels', () => {
    render([code]);
    expect(inner()).toHaveLength(1);
    const text = carriers().find(
      (node) =>
        node.props.descriptor &&
        JSON.parse(node.props.descriptor).kind === 'text'
    )!;
    const boundary = carriers().filter(
      (node) => node.props.descriptor === undefined
    );
    expect(boundary).toHaveLength(1);
    expect(textOf(boundary[0])).toBe('CodeCopy');
    function sourceText(
      node: import('react-test-renderer').ReactTestInstance
    ): string {
      if (node !== text && carriers().includes(node)) return '';
      return node.children
        .map((child) => (typeof child === 'string' ? child : sourceText(child)))
        .join('');
    }
    expect(sourceText(text)).toBe(code.content);
    const horizontal = text.findAll(
      (node) => typeof node.type === 'string' && node.props.horizontal
    );
    expect(horizontal).toHaveLength(1);
    expect(
      horizontal[0].findAll((node) => carriers().includes(node))
    ).toHaveLength(0);
    expect(text.props.style).toMatchObject({
      borderWidth: 1,
      borderRadius: '$s',
      overflow: 'hidden',
      flex: 1,
    });
    expect(boundary[0].props.style).toMatchObject({
      paddingVertical: '$l',
      paddingLeft: '$l',
      paddingRight: '$l',
      borderBottomWidth: 1,
    });
    const copy = boundary[0].findAll(
      (node) => typeof node.type === 'string' && node.props.onPress
    );
    expect(copy).toHaveLength(1);
    const id = inner()[0].blockId;
    render([{ ...code, content: 'return 7;' }]);
    expect(inner()[0].blockId).toBe(id);
    expect(inner()[0].revision).toBe(
      JSON.stringify({ ...code, content: 'return 7;' })
    );
  });
  it('preserves every existing code host style with metadata disabled or enabled', () => {
    const layouts: unknown[][] = [];
    for (const enabled of [false, true]) {
      act(() => {
        tree?.unmount();
        tree = create(
          <NativeReadRowContext.Provider value={enabled ? row : null}>
            <Render content={[code]} />
          </NativeReadRowContext.Provider>
        );
      });
      layouts.push(
        tree!.root
          .findAll((node) => typeof node.type === 'string')
          .map((node) => node.props.style)
      );
    }
    expect(layouts[1]).toEqual(layouts[0]);
  });
  it.each(['render', 'textRender', 'textAsChild'] as const)(
    'does not certify custom CodeBlock %s',
    (custom) => {
      const settings =
        custom === 'render'
          ? { render: <TamaguiView /> }
          : {
              textProps:
                custom === 'textRender'
                  ? { render: <TamaguiView /> }
                  : { asChild: true as const },
            };
      const Custom = createContentRenderer({
        blockSettings: { code: settings },
      });
      render([code], { renderer: Custom });
      expect(inner()).toHaveLength(0);
      expect(
        carriers().filter((node) => node.props.descriptor === undefined)
      ).toHaveLength(0);
    }
  );
  it('preserves the existing invalid multi-child asChild rejection', () => {
    const Custom = createContentRenderer({
      blockSettings: { code: { asChild: true } },
    });
    expect(() => render([code], { renderer: Custom })).toThrow(
      'React.Children.only'
    );
  });
  it('keeps Android and replaced code renderer outside native authority', () => {
    Platform.OS = 'android';
    render([code]);
    expect(carriers()).toHaveLength(0);
    Platform.OS = 'ios';
    const Custom = createContentRenderer({
      blockRenderers: { code: () => <TamaguiView>custom code</TamaguiView> },
    });
    render([code], { renderer: Custom });
    expect(inner()).toHaveLength(0);
  });
});

describe('actual native reading content carriers', () => {
  it('keeps the installed native View optimization active in this control boundary', () => {
    act(() => {
      tree = create(<TamaguiView testID="ordinary">ordinary</TamaguiView>);
    });
    expect(host('RCTView').props.testID).toBe('ordinary');
    expect(carriers()).toHaveLength(0);
  });
  it('forwards row layout, touch handlers and ref through the styled native host', () => {
    const onLayout = vi.fn();
    const onPress = vi.fn();
    const ref =
      createRef<React.ComponentRef<typeof import('react-native').View>>();
    act(() => {
      tree = create(
        <NativeReadRowContext.Provider value={row}>
          <Render
            content={[paragraph('owned')]}
            ref={ref}
            onLayout={onLayout}
            onPress={onPress}
            style={{ width: 240 }}
          />
        </NativeReadRowContext.Provider>,
        {
          createNodeMock: (element) => ({
            descriptor: (element.props as { descriptor?: string }).descriptor,
          }),
        }
      );
    });
    const outer = carriers().find(
      (node) => JSON.parse(node.props.descriptor).kind === 'row'
    )!;
    expect(outer.props.style).toMatchObject({ width: 240 });
    expect(ref.current).toEqual({ descriptor: outer.props.descriptor });
    outer.props.onLayout({
      nativeEvent: { layout: { width: 240, height: 40 } },
    });
    const press = {
      persist() {},
      currentTarget: 7,
      nativeEvent: {
        pageX: 20,
        pageY: 20,
        touches: [{ pageX: 20, pageY: 20 }],
      },
    };
    act(() => {
      outer.props.onResponderGrant(press);
      outer.props.onResponderRelease(press);
    });
    expect(onLayout).toHaveBeenCalledOnce();
    expect(onPress).toHaveBeenCalledOnce();
    expect(textOf(outer)).toBe('owned');
  });
  it.each(['release', 'terminate', 'long-press'] as const)(
    'uses the installed native responder for %s without another host',
    (operation) => {
      vi.useFakeTimers();
      const onPress = vi.fn(),
        onPressIn = vi.fn(),
        onPressOut = vi.fn(),
        onLongPress = vi.fn();
      act(() => {
        tree = create(
          <NativeReadItemContainer
            descriptor="touch-owner"
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onLongPress={onLongPress}
          >
            owned
          </NativeReadItemContainer>
        );
      });
      const actual = carriers()[0];
      const event = {
        persist() {},
        currentTarget: 7,
        nativeEvent: {
          pageX: 20,
          pageY: 20,
          locationX: 20,
          locationY: 20,
          touches: [{ pageX: 20, pageY: 20 }],
        },
      };
      expect(actual.props.onStartShouldSetResponder(event)).toBe(true);
      act(() => actual.props.onResponderGrant(event));
      expect(onPressIn).toHaveBeenCalledOnce();
      if (operation === 'long-press')
        act(() => {
          vi.advanceTimersByTime(500);
        });
      act(() =>
        actual.props[
          operation === 'terminate'
            ? 'onResponderTerminate'
            : 'onResponderRelease'
        ](event)
      );
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(onPress).toHaveBeenCalledTimes(operation === 'release' ? 1 : 0);
      expect(onLongPress).toHaveBeenCalledTimes(
        operation === 'long-press' ? 1 : 0
      );
      expect(onPressOut).toHaveBeenCalledOnce();
      expect(carriers()).toHaveLength(1);
      expect(hosts('RNView')).toHaveLength(0);
      act(() =>
        tree!.update(
          <NativeReadItemContainer
            descriptor="touch-owner"
            disabled
            onPress={onPress}
          >
            owned
          </NativeReadItemContainer>
        )
      );
      expect(carriers()[0].props.onStartShouldSetResponder(event)).toBe(false);
      act(() => tree!.unmount());
      expect(vi.getTimerCount()).toBe(0);
      tree = undefined;
      vi.useRealTimers();
    }
  );
  it('respects external press ownership and preserves supplied responder callbacks', () => {
    vi.useFakeTimers();
    const onPress = vi.fn(),
      onGrant = vi.fn(),
      onRelease = vi.fn();
    act(() => {
      tree = create(
        <NativeReadItemContainer
          descriptor="owned"
          onPress={onPress}
          onResponderGrant={onGrant}
          onResponderRelease={onRelease}
        >
          owned
        </NativeReadItemContainer>
      );
    });
    const event = {
      persist() {},
      currentTarget: 7,
      nativeEvent: {
        pageX: 20,
        pageY: 20,
        touches: [{ pageX: 20, pageY: 20 }],
      },
    };
    nativePressOwnership.active = true;
    expect(carriers()[0].props.onStartShouldSetResponder(event)).toBe(false);
    nativePressOwnership.active = false;
    act(() => carriers()[0].props.onResponderGrant(event));
    nativePressOwnership.active = true;
    act(() => {
      carriers()[0].props.onResponderRelease(event);
      vi.advanceTimersByTime(200);
    });
    expect(onPress).not.toHaveBeenCalled();
    expect(onGrant).toHaveBeenCalledOnce();
    expect(onRelease).toHaveBeenCalledOnce();
  });
  it('retires pending native long-press timers on carrier unmount', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    act(() => {
      tree = create(
        <NativeReadItemContainer descriptor="owned" onLongPress={onLongPress}>
          owned
        </NativeReadItemContainer>
      );
    });
    const event = {
      persist() {},
      currentTarget: 7,
      nativeEvent: {
        pageX: 20,
        pageY: 20,
        touches: [{ pageX: 20, pageY: 20 }],
      },
    };
    act(() => carriers()[0].props.onResponderGrant(event));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() => tree!.unmount());
    tree = undefined;
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });
  it('retains actual Pressable style, disabled behavior, callbacks and ref when replacing its host', () => {
    vi.useFakeTimers();
    const layouts: object[] = [];
    for (const enabled of [false, true]) {
      const onPress = vi.fn(),
        onLongPress = vi.fn(),
        onPressIn = vi.fn(),
        onPressOut = vi.fn(),
        onLayout = vi.fn();
      const ref =
        createRef<React.ComponentRef<typeof import('react-native').View>>();
      act(() => {
        tree?.unmount();
        tree = create(
          <Pressable
            ref={ref}
            testID="actual-image-host"
            padding={13}
            style={{ width: 201 }}
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onLayout={onLayout}
            renderFrame={
              enabled ? (
                <NativeReadImageFrame descriptor="owned-media" />
              ) : undefined
            }
          >
            image
          </Pressable>,
          { createNodeMock: () => ({ host: 'actual-image-host' }) }
        );
      });
      const actual = tree!.root.findAll(
        (n) =>
          typeof n.type === 'string' && n.props.testID === 'actual-image-host'
      )[0];
      layouts.push(actual.props.style);
      expect(actual.props.style).toEqual({ padding: 13, width: 201 });
      expect(actual.props.pressStyle).toEqual({ opacity: 0.5 });
      if (!enabled) expect(actual.props.disabled).toBe(false);
      expect(ref.current).toEqual({ host: 'actual-image-host' });
      if (enabled) {
        const press = {
          persist() {},
          currentTarget: 7,
          nativeEvent: {
            pageX: 20,
            pageY: 20,
            touches: [{ pageX: 20, pageY: 20 }],
          },
        };
        expect(actual.props.onStartShouldSetResponder(press)).toBe(true);
        act(() => {
          actual.props.onResponderGrant(press);
          actual.props.onResponderRelease(press);
          vi.advanceTimersByTime(200);
        });
        act(() => {
          actual.props.onResponderGrant(press);
          vi.advanceTimersByTime(500);
          actual.props.onResponderRelease(press);
          vi.advanceTimersByTime(200);
        });
        actual.props.onLayout({});
        expect(onPressIn).toHaveBeenCalledTimes(2);
        expect(onPressOut).toHaveBeenCalledTimes(2);
      } else {
        for (const event of [
          'onPress',
          'onLongPress',
          'onPressIn',
          'onPressOut',
          'onLayout',
        ])
          actual.props[event]({});
        expect(onPressIn).toHaveBeenCalledOnce();
        expect(onPressOut).toHaveBeenCalledOnce();
      }
      for (const callback of [onPress, onLongPress, onLayout])
        expect(callback).toHaveBeenCalledOnce();
      expect(actual.props.descriptor).toBe(enabled ? 'owned-media' : undefined);
      act(() =>
        tree!.update(
          <Pressable
            testID="actual-image-host"
            renderFrame={
              enabled ? (
                <NativeReadImageFrame descriptor="owned-media" />
              ) : undefined
            }
          >
            no handler
          </Pressable>
        )
      );
      const disabledHost = tree!.root.findAll(
        (n) =>
          typeof n.type === 'string' && n.props.testID === 'actual-image-host'
      )[0];
      if (enabled)
        expect(
          disabledHost.props.onStartShouldSetResponder?.({}) ?? false
        ).toBe(false);
      else expect(disabledHost.props.disabled).toBe(true);
    }
    expect(layouts[0]).toEqual(layouts[1]);
  });
  it.each(['paragraph', 'image'] as const)(
    'keeps %s row and inner styled defaults identical with metadata off/on',
    (kind) => {
      const block =
        kind === 'paragraph'
          ? paragraph('same content')
          : image('https://a/image');
      const layouts: Record<string, unknown>[][] = [];
      for (const enabled of [false, true]) {
        act(() => {
          tree?.unmount();
          tree = create(
            <NativeReadRowContext.Provider value={enabled ? row : null}>
              <Render
                content={[block]}
                testID="comparison-row"
                paddingBottom={7}
              />
            </NativeReadRowContext.Provider>
          );
        });
        const rowHost = tree!.root.findAll(
          (n) =>
            typeof n.type === 'string' && n.props.testID === 'comparison-row'
        )[0];
        const blockHost = tree!.root.findAll(
          (n) => typeof n.type === 'string' && n.props.block === block
        )[0];
        expect(blockHost.props.style.padding).toBe('$l');
        expect(rowHost.props.style).toMatchObject({
          width: '100%',
          flexDirection: 'column',
          paddingBottom: 7,
        });
        const styles = [rowHost.props.style, blockHost.props.style];
        if (kind === 'image') {
          const pressHost = tree!.root.findAll(
            (n) =>
              typeof n.type === 'string' &&
              (n.props.onPress || n.props.onStartShouldSetResponder) &&
              n.props.style?.overflow === 'hidden'
          )[0];
          styles.push(pressHost.props.style);
          expect(pressHost.props.style).toMatchObject({
            overflow: 'hidden',
            maxWidth: 200,
          });
        }
        layouts.push(styles);
      }
      expect(layouts[1]).toEqual(layouts[0]);
    }
  );
  it('publishes exact current row and block content without an extra host or view inside Text', () => {
    render([paragraph('hello')]);
    expect(rowDescriptor()).toMatchObject({
      ...row,
      kind: 'row',
      unresolvedBlockIds: [],
    });
    expect(rowDescriptor().blocks[0].revision).toBe(
      JSON.stringify(paragraph('hello'))
    );
    expect(inner()[0]).toMatchObject({
      ...binding,
      key: row.key,
      rowRevision: row.revision,
      blockId: rowDescriptor().blocks[0].id,
      kind: 'text',
    });
    expect(textOf(host('Text'))).toBe('hello');
    expect(carriers()[0].props).toMatchObject({
      testID: 'content',
      accessibilityLabel: 'message',
      style: { paddingBottom: 7, width: '100%' },
    });
    expect(hosts('ContentFrame')).toHaveLength(0);
    expect(hosts('ContentBlock')).toHaveLength(0);
  });
  it('retains edited block identity and independently rendered last-edit fallback', () => {
    render([paragraph('old')]);
    const id = rowDescriptor().blocks[0].id;
    render([paragraph('edited')]);
    expect(rowDescriptor().blocks[0].id).toBe(id);
    expect(inner()[0].revision).toBe(JSON.stringify(paragraph('edited')));
    render([paragraph('old')]);
    expect(rowDescriptor().blocks[0].id).toBe(id);
    expect(inner()[0].revision).toBe(JSON.stringify(paragraph('old')));
  });
  it('uses actual PostContentRenderer conversion result', () => {
    const post: Post = {
      id: row.key,
      authorId: '~zod',
      type: 'chat',
      channelId: binding.scope,
      sentAt: 1,
      receivedAt: 1,
      content: JSON.stringify([paragraph('wire')]),
    };
    act(() => {
      tree = create(
        <NativeReadRowContext.Provider value={row}>
          <PostContentRenderer post={post} />
        </NativeReadRowContext.Provider>
      );
    });
    expect(rowDescriptor().blocks[0].revision).toBe(
      JSON.stringify(paragraph('wire'))
    );
  });
  it('keeps identities on insertion/reorder and declares removed versus ambiguous blocks', () => {
    render([paragraph('a'), paragraph('b')]);
    const [a, b] = rowDescriptor().blocks.map((x: { id: string }) => x.id);
    render([paragraph('b'), paragraph('a')]);
    expect(rowDescriptor().blocks.map((x: { id: string }) => x.id)).toEqual([
      b,
      a,
    ]);
    render([paragraph('b')]);
    expect(rowDescriptor().blocks[0].id).toBe(b);
    expect(rowDescriptor().unresolvedBlockIds).not.toContain(a);
    render([paragraph('split 1'), paragraph('split 2')]);
    expect(rowDescriptor().unresolvedBlockIds).toContain(b);
  });
  it('resets lineage ownership on membership incarnation or visit change', () => {
    render([paragraph('a'), paragraph('b')]);
    render([paragraph('b')]);
    const prior = rowDescriptor().blocks[0].id;
    render([paragraph('new')], { row: { ...row, revision: 'member-2' } });
    expect(rowDescriptor().revision).toBe('member-2');
    expect(rowDescriptor().blocks[0].id).not.toBe(prior);
    render([paragraph('next')], { row: { ...row, visit: 'visit-2' } });
    expect(inner()[0].visit).toBe('visit-2');
  });
  it('does not register nested content as the containing row', () => {
    const Nested = createContentRenderer({
      blockRenderers: {
        paragraph: () => <Render content={[paragraph('nested')]} />,
      },
    });
    render([paragraph('outer')], { renderer: Nested });
    expect(descriptors()).toHaveLength(1);
    expect(rowDescriptor().blocks[0].revision).toBe(
      JSON.stringify(paragraph('outer'))
    );
  });
  it('does not register a reference renderer even if row context leaks in', () => {
    render([paragraph('quoted')], { inside: true });
    expect(carriers()).toHaveLength(0);
  });
  it('retains custom unsupported blocks in membership without claiming inner geometry', () => {
    const Custom = createContentRenderer({
      blockRenderers: { code: () => <TamaguiView>custom</TamaguiView> },
    });
    render([{ type: 'code', content: 'let x = 1', lang: 'js' }], {
      renderer: Custom,
    });
    expect(rowDescriptor().blocks).toHaveLength(1);
    expect(inner()).toEqual([]);
  });
  it('keeps web rendering and original image lifetime outside native reading', () => {
    Platform.OS = 'web';
    render([paragraph('web'), image('https://a/image')]);
    expect(carriers()).toHaveLength(0);
    const old = imageNode();
    render([paragraph('web'), image('https://b/image')]);
    expect(imageNode() === old).toBe(true);
  });
  it('leaves custom wrapper render overrides intact and unavailable', () => {
    const Custom = createContentRenderer({
      blockSettings: {
        paragraph: { wrapperProps: { render: <React.Fragment /> } },
      },
    });
    render([paragraph('custom')], { renderer: Custom });
    expect(inner()).toHaveLength(0);
  });
});

describe('current native image source ownership', () => {
  it('requires successful exact source URL and positive dimensions', () => {
    render([image('https://a/image')]);
    expect(inner()[0].mediaReady).toBe(false);
    act(() => imageNode().props.onLoad(load('https://wrong/image')));
    expect(inner()[0].mediaReady).toBe(false);
    act(() => imageNode().props.onLoad(load('https://a/image', 0)));
    expect(inner()[0].mediaReady).toBe(false);
    act(() => imageNode().props.onLoad(load('https://a/image')));
    expect(inner()[0].mediaReady).toBe(true);
  });
  it('clears readiness on replacement and ignores old and ABA load callbacks', () => {
    render([image('https://a/image')]);
    const firstNode = imageNode();
    const old = firstNode.props.onLoad;
    act(() => old(load('https://a/image')));
    expect(inner()[0].mediaReady).toBe(true);
    render([image('https://b/image')]);
    expect(inner()[0].mediaReady).toBe(false);
    expect(imageNode() === firstNode).toBe(false);
    const second = imageNode().props.onLoad;
    render([image('https://a/image')]);
    act(() => {
      old(load('https://a/image'));
      second(load('https://b/image'));
    });
    expect(inner()[0].mediaReady).toBe(false);
    act(() => imageNode().props.onLoad(load('https://a/image')));
    expect(inner()[0].mediaReady).toBe(true);
  });
  it('retired source cannot change current dimensions or dispatch its external callback', () => {
    const callback = vi.fn();
    const Custom = createContentRenderer({
      blockSettings: { image: { imageProps: { onLoad: callback } } },
    });
    render([image('https://a/image')], { renderer: Custom });
    const old = imageNode().props.onLoad;
    render([image('https://b/image')], { renderer: Custom });
    act(() => old(load('https://a/image', 1, 1000)));
    expect(callback).not.toHaveBeenCalled();
    expect(inner()[0].mediaReady).toBe(false);
    act(() => imageNode().props.onLoad(load('https://b/image')));
    expect(callback).toHaveBeenCalledTimes(1);
  });
  it('uses effective imageProps source and preserves touch/load/error callbacks', () => {
    const onLoad = vi.fn(),
      onError = vi.fn(),
      onLoadStart = vi.fn();
    const Override = createContentRenderer({
      blockSettings: {
        image: {
          imageProps: {
            source: { uri: 'https://override/image' },
            onLoad,
            onError,
            onLoadStart,
          },
        },
      },
    });
    render([image('https://wire/image')], { renderer: Override });
    expect(rowDescriptor().blocks[0].assetKey).toBe(
      JSON.stringify({ uri: 'https://override/image' })
    );
    expect(imageNode().props.source).toEqual({ uri: 'https://override/image' });
    act(() => imageNode().props.onLoadStart());
    expect(onLoadStart).toHaveBeenCalledTimes(1);
    act(() => imageNode().props.onLoad(load('https://override/image')));
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(inner()[0].mediaReady).toBe(true);
    act(() => imageNode().props.onError({ error: 'failed' }));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(inner()[0].mediaReady).toBe(false);

    expect(
      carriers().find(
        (node) => JSON.parse(node.props.descriptor).kind === 'media'
      )!.props.onStartShouldSetResponder
    ).toBeTypeOf('function');
  });
  it('invalid source stays unavailable rather than adopting the wire source', () => {
    const Missing = createContentRenderer({
      blockSettings: { image: { imageProps: { source: undefined } } },
    });
    render([image('https://wire/image')], { renderer: Missing });
    act(() => imageNode().props.onLoad(load('https://wire/image')));
    expect(inner()[0].mediaReady).toBe(false);
  });
  it('a previous visit callback cannot certify the same asset in the next visit', () => {
    render([image('https://a/image')]);
    const old = imageNode().props.onLoad;
    render([image('https://a/image')], {
      row: { ...row, visit: 'visit-next' },
    });
    act(() => old(load('https://a/image')));
    expect(inner()[0].mediaReady).toBe(false);
  });
});

it('ScrollerItem supplies only exact current membership without introducing a host', () => {
  const post: Post = {
    id: row.key,
    type: 'chat',
    channelId: binding.scope,
    authorId: '~zod',
    sentAt: 1,
    receivedAt: 1,
  };
  const noop = () => {};
  const Message = () => <Render content={[paragraph('actual row')]} />;
  const props = {
    item: post,
    index: 0,
    showUnreadDivider: false,
    showDayDivider: false,
    showAuthor: true,
    Component: Message,
    onLongPressPost: noop,
    onPressDelete: noop,
    onShowEmojiPicker: noop,
    messageRef:
      createRef<React.ComponentRef<typeof import('react-native').View>>(),
    isSelected: false,
    isLastPostOfBlock: false,
    dividersEnabled: false,
    columnCount: 1,
  };
  const membership = reconcileReadMembership(emptyReadMembership, [post.id]);
  act(() => {
    tree = create(
      <NativeReadListContext.Provider value={{ binding, membership }}>
        <ScrollerItem {...props} />
      </NativeReadListContext.Provider>
    );
  });
  expect(rowDescriptor().revision).toBe(membership.rows[0].revision);
  const views = hosts('View').length;
  act(() =>
    tree!.update(
      <NativeReadListContext.Provider
        value={{
          binding,
          membership: reconcileReadMembership(membership, ['another']),
        }}
      >
        <ScrollerItem {...props} />
      </NativeReadListContext.Provider>
    )
  );
  expect(carriers()).toHaveLength(0);
  expect(hosts('View')).toHaveLength(views);
});

it('native scope preserves descriptor, accessibility, events, children and ref', () => {
  const ref = createRef<React.ComponentRef<typeof NativeReadScopeContainer>>();
  const onLayout = vi.fn();
  act(() => {
    tree = create(
      <NativeReadScopeContainer
        ref={ref}
        descriptor="scope-json"
        testID="scope"
        accessibilityLabel="scope"
        pointerEvents="none"
        style={{ height: 0 }}
        onLayout={onLayout}
      >
        <React.Fragment>child</React.Fragment>
      </NativeReadScopeContainer>,
      { createNodeMock: () => ({ native: true }) }
    );
  });
  expect(host('native-ScrollReadScopeContainer').props).toMatchObject({
    descriptor: 'scope-json',
    testID: 'scope',
    onLayout,
    style: { height: 0 },
  });
  expect(ref.current).toEqual({ native: true });
});

it('abandoned content render cannot consume the committed block lineage', async () => {
  const suspended = new Promise<void>(() => {});
  const Interruptible = createContentRenderer({
    blockRenderers: {
      paragraph: ({ block }) => {
        if (
          block.content.some(
            (inline) => inline.type === 'text' && inline.text === 'suspend'
          )
        )
          throw suspended;
        return null;
      },
    },
  });
  let update: React.Dispatch<React.SetStateAction<BlockData[]>>;
  const App = () => {
    const [content, setContent] = React.useState<BlockData[]>([
      paragraph('a'),
      paragraph('b'),
    ]);
    update = setContent;
    return (
      <Suspense fallback={null}>
        <NativeReadRowContext.Provider value={row}>
          <Interruptible content={content} />
        </NativeReadRowContext.Provider>
      </Suspense>
    );
  };
  await act(async () => {
    tree = create(<App />);
  });
  const original = rowDescriptor().blocks.map(
    (block: { id: string }) => block.id
  );
  await act(async () => {
    React.startTransition(() =>
      update([paragraph('suspend'), paragraph('new'), paragraph('extra')])
    );
  });
  await act(async () => update([paragraph('edited a'), paragraph('b')]));
  expect(
    rowDescriptor().blocks.map((block: { id: string }) => block.id)
  ).toEqual(original);
  expect(rowDescriptor().unresolvedBlockIds).toEqual([]);
});

it('non-iOS fallback strips descriptor while forwarding ordinary View props and ref', async () => {
  const { NativeReadScopeContainer: Fallback } = await vi.importActual<
    typeof import('../ScrollReadContainers')
  >('../ScrollReadContainers');
  const ref = createRef<React.ComponentRef<typeof Fallback>>();
  act(() => {
    tree = create(
      <Fallback
        ref={ref}
        descriptor="not-native"
        testID="plain"
        style={{ height: 0 }}
      >
        child
      </Fallback>,
      { createNodeMock: () => ({ plain: true }) }
    );
  });
  expect(host('RNView').props.descriptor).toBeUndefined();
  expect(host('RNView').props.testID).toBe('plain');
  expect(ref.current).toEqual({ plain: true });
});

it('failed image ticket cannot become ready from a late success on its retired native image', () => {
  render([image('https://a/image')]);
  const loaded = imageNode().props.onLoad;
  act(() => {
    imageNode().props.onError({ error: 'failed' });
    loaded(load('https://a/image'));
  });
  expect(inner()[0].mediaReady).toBe(false);
});

it('nonfinite image geometry cannot declare readiness', () => {
  render([image('https://a/image')]);
  act(() => imageNode().props.onLoad(load('https://a/image', Infinity, 100)));
  expect(inner()[0].mediaReady).toBe(false);
});

it('same asset content revision keeps its loaded physical image while publishing the current block revision', () => {
  render([image('https://a/image')]);
  act(() => imageNode().props.onLoad(load('https://a/image')));
  const loaded = imageNode();
  const id = inner()[0].blockId;
  const changed = {
    ...image('https://a/image'),
    alt: 'updated description',
    width: 100,
  };
  render([changed]);
  expect(inner()[0].revision).toBe(JSON.stringify(changed));
  expect(inner()[0].blockId).toBe(id);
  expect(inner()[0].mediaReady).toBe(true);
  expect(imageNode() === loaded).toBe(true);
});
