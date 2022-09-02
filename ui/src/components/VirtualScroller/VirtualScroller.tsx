import _ from 'lodash';
import React, { Component, CSSProperties, ReactNode, useCallback } from 'react';
import { VirtualContext } from './VirtualContext';
import clamp from './util';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';

/**
 * This VirtualScroller is based on the implementation from Groups 1 by the
 * incomparable @liam-fitzgerald
 *
 * See:
 * https://github.com/urbit/urbit/blob/master/pkg/interface/src/views/components/VirtualScroller.tsx
 */

function Center(props: React.HTMLProps<HTMLDivElement>) {
  return (
    <div {...props} className="align-center flex h-8 w-full justify-center" />
  );
}

interface ScrollbarLessBoxProps {
  children: ReactNode;
  style: CSSProperties;
  onScroll: () => void;
  className: string;
}

const ScrollbarLessBox = React.forwardRef<
  HTMLDivElement,
  ScrollbarLessBoxProps
>(({ children, style, ...props }, ref) => (
  <div
    // tsc does not like `!important`
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    style={{ ...style, scrollbarWidth: 'none !important' }}
    ref={ref}
    {...props}
  >
    {children}
  </div>
));

interface ScrollbarProps {
  style: CSSProperties;
}

const Scrollbar = React.forwardRef<HTMLDivElement, ScrollbarProps>(
  ({ style, ...props }, ref) => (
    <div
      style={{
        ...style,
        zIndex: 3,
        width: '4px',
        borderRadius: '999px',
        right: 0,
        height: '50px',
        position: 'absolute',
        cursor: 'pointer',
      }}
      ref={ref}
      {...props}
    />
  )
);

interface RendererProps<K> {
  index: K;
  scrollWindow: HTMLDivElement | null;
  ref: (el: HTMLElement | null) => void;
}

interface OrderedMap<K, V> extends Iterable<[K, V]> {
  peekLargest: () => [K, V] | undefined;
  peekSmallest: () => [K, V] | undefined;
  size: number;
  keys: () => K[];
}

interface VirtualChildProps<K> {
  index: K;
  scrollWindow: HTMLDivElement | null;
  setRef: (el: HTMLElement | null, index: K) => void;
  renderer: (p: RendererProps<K>) => JSX.Element | null;
}

function VirtualChild<K>(props: VirtualChildProps<K>) {
  const { setRef, renderer: Renderer, ...rest } = props;

  const ref = useCallback((el: HTMLElement | null) => {
    const { index } = props;
    setRef(el, index);
    //  VirtualChild should always be keyed on the index, so the index should be
    //  valid for the entire lifecycle of the component, hence no dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Renderer ref={ref} {...rest} />;
}

export interface VirtualScrollerProps<K, V> {
  /**
   * Start scroll from
   */
  origin: 'top' | 'bottom';
  /**
   * Load more of the graph
   *
   * @returns boolean whether or not the graph is now fully loaded
   */
  loadRows(newer: boolean): Promise<boolean>;
  /**
   * The data to iterate over
   */
  data: OrderedMap<K, V>;
  /*
   * The component to render the items
   *
   * @remarks
   *
   * This component must be referentially stable, so either use `useCallback` or
   * a instance method. It must also forward the DOM ref from its root DOM node
   */
  renderer: (props: RendererProps<K>) => JSX.Element | null;
  onStartReached?(): void;
  onEndReached?(): void;
  size: number;
  pendingSize: number;
  scrollTo?: K;
  /*
   * Average height of a single rendered item
   *
   * @remarks
   * This is used primarily to calculate how many items should be onscreen. If
   * size is variable, err on the lower side.
   */
  averageHeight: number;
  /*
   * The offset to begin rendering at, on load.
   *
   * @remarks
   * This is only looked up once, on component creation. Subsequent changes to
   * this prop will have no effect
   *
   * @deprecated
   */
  // offset: number;
  style?: CSSProperties;
  /*
   * Callback to execute when finished loading from start
   */
  onBottomLoaded?: () => void;
  /*
   * Callback to execute when finished loading from end
   */
  onTopLoaded?: () => void;

  /*
   * equality function for the key type
   */
  keyEq: (a: K, b: K) => boolean;
  /*
   * string conversion for key type
   */
  keyToString: (k: K) => string;
  /*
   * default value for key type
   */
  keyBunt: K;
}

interface VirtualScrollerState<K> {
  visibleItems: K[];
  loaded: {
    top: boolean;
    bottom: boolean;
  };
}

type LogLevel = 'scroll' | 'network' | 'bail' | 'reflow';
const logLevel =
  process.env.NODE_ENV === 'production'
    ? []
    : (['network', 'bail', 'scroll', 'reflow'] as LogLevel[]);

const log = (level: LogLevel, message: string) => {
  if (logLevel.includes(level)) {
    // eslint-disable-next-line no-console
    console.log(`[${level}]: ${message}`);
  }
};

const ZONE_SIZE = 80;

// nb: in this file, an index refers to a BigInteger and an offset refers to a
// number used to index a listified BigIntOrderedMap

/*
 * A virtualscroller for a `BigIntOrderedMap`.
 *
 * VirtualScroller does not clean up or reset itself, so please use `key`
 * to ensure a new instance is created for each BigIntOrderedMap
 */
export default class VirtualScroller<K, V> extends Component<
  VirtualScrollerProps<K, V>,
  VirtualScrollerState<K>
> {
  /*
   * A reference to our scroll container
   */
  window: HTMLDivElement | null = null;

  /*
   * A map of child refs, used to calculate scroll position
   */
  private childRefs = new Map<string, HTMLElement>();

  /*
   * A set of child refs which have been unmounted
   */
  private orphans = new Set<string>();

  /*
   *  If saving, the bottommost visible element that we pin our scroll to
   */
  private savedIndex: K | null = null;

  /*
   *  If saving, the distance between the top of `this.savedEl` and the bottom
   *  of the screen
   */
  private savedDistance = 0;

  /*
   *  If saving, the number of requested saves. If several images are loading
   *  at once, we save the scroll pos the first time we see it and restore
   *  once the number of requested saves is zero
   */
  private saveDepth = 0;

  scrollLocked = true;

  private pageSize = 50;

  private pageDelta = 15;

  private scrollRef: HTMLElement | null = null;

  private cleanupRefInterval: NodeJS.Timeout | null = null;

  private scrollDragging = false;

  // manipulate scrollbar manually, to dodge change detection
  updateScroll = _.throttle(() => {
    if (!this.window || !this.scrollRef) {
      return;
    }
    const { scrollTop, scrollHeight, offsetHeight } = this.window;

    // const unloaded = (this.startOffset() / this.pageSize);
    // const totalpages = this.props.size / this.pageSize;

    const loaded = scrollTop / (scrollHeight - offsetHeight);
    //  unused, maybe useful
    /* const result = this.scrollDragging
      ? (loaded * this.window.offsetHeight)
      : ((unloaded + loaded) / totalpages) *this.window.offsetHeight; */
    this.scrollRef.style.top = `${loaded * (offsetHeight - 50)}px`;
  }, 50);

  loadTop = _.throttle(() => this.loadRows(false), 100);

  loadBottom = _.throttle(() => this.loadRows(true), 100);

  // disabled until we work out race conditions with loading new nodes
  shiftLayout = {
    save: () => {
      // placeholder
    },
    restore: () => {
      // placeholder
    },
  };

  constructor(props: VirtualScrollerProps<K, V>) {
    super(props);
    this.state = {
      visibleItems: [],
      loaded: {
        top: false,
        bottom: false,
      },
    };

    this.updateVisible = this.updateVisible.bind(this);

    this.onScroll = this.onScroll.bind(this);
    this.scrollKeyMap = this.scrollKeyMap.bind(this);
    this.setWindow = this.setWindow.bind(this);
    this.restore = this.restore.bind(this);
    this.startOffset = this.startOffset.bind(this);
  }

  componentDidMount() {
    const { origin, scrollTo } = this.props;
    this.updateVisible(origin === 'top' ? 0 : this.lastOffset);

    this.loadTop();
    this.loadBottom();
    this.cleanupRefInterval = setInterval(this.cleanupRefs, 5000);

    if (scrollTo) {
      requestAnimationFrame(() => {
        this.scrollLocked = false;
        this.scrollToIndex(scrollTo);
      });
    }
  }

  componentDidUpdate(
    prevProps: VirtualScrollerProps<K, V>,
    _prevState: VirtualScrollerState<K>
  ) {
    const { size, pendingSize, origin, scrollTo } = this.props;

    if (scrollTo && prevProps.scrollTo !== scrollTo) {
      requestAnimationFrame(() => {
        this.scrollLocked = false;
        this.scrollToIndex(scrollTo);
      });
    }

    if (size !== prevProps.size || pendingSize !== prevProps.pendingSize) {
      if (!this.window) {
        return;
      }
      const scrollTop =
        origin === 'top'
          ? this.window.scrollTop
          : this.window.scrollHeight -
            this.window.scrollTop -
            this.window.offsetHeight;
      if ((scrollTop ?? 0) < ZONE_SIZE) {
        this.scrollLocked = true;
        this.updateVisible(origin === 'top' ? 0 : this.lastOffset);
        requestAnimationFrame(() => {
          this.resetScroll();
        });
      }
    }
  }

  componentWillUnmount() {
    if (this.cleanupRefInterval) {
      clearInterval(this.cleanupRefInterval);
    }
    this.cleanupRefs();
    this.childRefs.clear();
  }

  onMove = (e: MouseEvent) => {
    if (!this.scrollDragging || !this.window) {
      return;
    }
    const { origin } = this.props;
    const scrollProgress = e.movementY / this.window.offsetHeight;
    const scrollDir = origin === 'top' ? 1 : -1;
    const windowScroll = scrollDir * scrollProgress * this.window.scrollHeight;
    this.window.scrollBy(0, windowScroll);
  };

  onDown = (e: PointerEvent) => {
    if (!this.scrollRef) {
      return;
    }
    this.scrollRef.setPointerCapture(e.pointerId);
    document.documentElement.style.setProperty('--user-select', 'none');
    this.scrollDragging = true;
  };

  onUp = (e: PointerEvent) => {
    if (!this.scrollRef) {
      return;
    }
    this.scrollRef.releasePointerCapture(e.pointerId);
    document.documentElement.style.removeProperty('--user-select');
    this.scrollDragging = false;
  };

  onScroll() {
    this.updateScroll();
    if (!this.window) {
      // bail if we're going to adjust scroll anyway
      return;
    }
    if (this.saveDepth > 0) {
      log('bail', 'deep scroll queue');
      return;
    }
    const { onStartReached, onEndReached } = this.props;
    const windowHeight = this.window.offsetHeight;
    const { scrollTop, scrollHeight } = this.window;

    const startOffset = this.startOffset();

    if (scrollTop < ZONE_SIZE) {
      log('scroll', `Entered start zone ${scrollTop}`);
      if (startOffset === 0) {
        if (onStartReached) {
          onStartReached();
        }
        this.scrollLocked = true;
      }

      const newOffset = clamp(
        startOffset - this.pageDelta,
        0,
        this.props.data.size - this.pageSize
      );
      if (newOffset < 10) {
        this.loadBottom();
      }

      if (newOffset !== startOffset) {
        this.updateVisible(newOffset);
      }
    } else if (scrollTop + windowHeight >= scrollHeight - ZONE_SIZE) {
      this.scrollLocked = false;
      log('scroll', `Entered end zone ${scrollTop}`);

      const newOffset = clamp(
        startOffset + this.pageDelta,
        0,
        this.props.data.size - this.pageSize
      );

      if (onEndReached && startOffset === 0) {
        onEndReached();
      }

      if (newOffset + 3 * this.pageSize > this.props.data.size) {
        this.loadTop();
      }

      if (newOffset !== startOffset) {
        this.updateVisible(newOffset);
      }
    } else {
      this.scrollLocked = false;
    }
  }

  get lastOffset() {
    const { size } = this.props;
    return Math.min(Math.max(size - this.pageSize, 0), size);
  }

  setScrollRef = (el: HTMLDivElement | null) => {
    if (!el) {
      if (this.scrollRef) {
        this.scrollRef.removeEventListener('pointerdown', this.onDown);
        this.scrollRef.removeEventListener('mousemove', this.onMove);
        this.scrollRef.removeEventListener('pointerup', this.onUp);
      }
      this.scrollRef = null;
      return;
    }
    this.scrollRef = el;
    this.scrollRef.addEventListener('pointerdown', this.onDown);
    this.scrollRef.addEventListener('mousemove', this.onMove);
    this.scrollRef.addEventListener('pointerup', this.onUp);
  };

  setWindow(element: HTMLDivElement | null) {
    if (!element) return;

    if (this.window) {
      if (this.window.isSameNode(element)) {
        return;
      }
    }
    const { averageHeight } = this.props;

    this.window = element;
    this.pageSize = Math.floor(
      element.offsetHeight / Math.floor(averageHeight / 2)
    );
    this.pageDelta = Math.floor(this.pageSize / 4);
    const { origin } = this.props;
    this.updateVisible(origin === 'top' ? 0 : this.lastOffset);
    requestAnimationFrame(() => {
      this.resetScroll();
    });
  }

  cleanupRefs = () => {
    if (this.saveDepth > 0) {
      return;
    }
    [...this.orphans].forEach((o) => {
      this.childRefs.delete(o);
    });
    this.orphans.clear();
  };

  loadRows = async (newer: boolean) => {
    const dir = newer ? 'bottom' : 'top';
    if (this.state.loaded[dir]) {
      return;
    }
    log('network', `loading more at ${dir}`);
    const done = await this.props.loadRows(newer);
    if (done) {
      const { loaded } = this.state;
      this.setState({
        loaded: {
          ...loaded,
          [dir]: done,
        },
      });
      if (newer && this.props.onBottomLoaded) {
        this.props.onBottomLoaded();
      }
      if (!newer && this.props.onTopLoaded) {
        this.props.onTopLoaded();
      }
    }
  };

  scrollToIndex = (index: K) => {
    const { keyToString, keyEq } = this.props;
    let ref = this.childRefs.get(keyToString(index));
    if (!ref) {
      const offset = [...this.props.data].findIndex(([idx]) =>
        keyEq(idx, index)
      );
      if (offset === -1) {
        return;
      }
      this.scrollLocked = false;
      // TODO: does not work for origin === top.
      this.updateVisible(Math.max(this.lastOffset - offset - this.pageSize, 0));
      requestAnimationFrame(() => {
        ref = this.childRefs.get(keyToString(index));
        requestAnimationFrame(() => {
          this.savedIndex = null;
          this.savedDistance = 0;
          this.saveDepth = 0;
        });

        ref?.scrollIntoView({ block: 'center' });
      });
    } else {
      ref?.scrollIntoView({ block: 'center' });
      requestAnimationFrame(() => {
        this.savedIndex = null;
        this.savedDistance = 0;
        this.saveDepth = 0;
      });
    }
  };

  setRef = (element: HTMLElement | null, index: K) => {
    const { keyToString } = this.props;
    if (element) {
      this.childRefs.set(keyToString(index), element);
      this.orphans.delete(keyToString(index));
    } else {
      this.orphans.add(keyToString(index));
    }
  };

  save() {
    if (!this.window || this.savedIndex) {
      return;
    }
    log('reflow', `saving @ ${this.saveDepth}`);
    if (this.saveDepth !== 0) {
      return;
    }

    log('scroll', 'saving...');

    // eslint-disable-next-line no-plusplus
    this.saveDepth++;
    const { visibleItems } = this.state;
    const { keyToString, averageHeight } = this.props;

    const { origin } = this.props;
    const { scrollTop } = this.window;
    const topSpacing = scrollTop;
    const items = origin === 'top' ? visibleItems : [...visibleItems].reverse();
    let bottomIndex = items[0];
    items.forEach((index) => {
      const el = this.childRefs.get(keyToString(index));
      if (!el) {
        return;
      }
      const { offsetTop } = el;
      if (Math.abs(offsetTop - topSpacing) < 2 * averageHeight) {
        bottomIndex = index;
      }
    });

    if (!bottomIndex) {
      // weird, shouldn't really happen
      // eslint-disable-next-line no-plusplus
      this.saveDepth--;
      log('bail', 'no index found');
      return;
    }

    this.savedIndex = bottomIndex;
    const ref = this.childRefs.get(keyToString(bottomIndex))!;
    if (!ref) {
      // eslint-disable-next-line no-plusplus
      this.saveDepth--;
      log('bail', 'missing ref');
      return;
    }
    const { offsetTop } = ref;
    this.savedDistance = topSpacing - offsetTop;
  }

  restore() {
    const { keyToString } = this.props;
    if (!this.window || !this.savedIndex) {
      return;
    }
    if (this.saveDepth !== 1) {
      log('bail', 'Deep restore');
      return;
    }
    if (this.scrollLocked) {
      this.resetScroll();
      requestAnimationFrame(() => {
        this.savedIndex = null;
        this.savedDistance = 0;
        this.saveDepth -= 1;
      });
      return;
    }

    const ref = this.childRefs.get(keyToString(this.savedIndex));
    if (!ref) {
      return;
    }

    const newScrollTop = this.savedDistance + ref.offsetTop;

    this.window.scrollTo(0, newScrollTop);
    requestAnimationFrame(() => {
      this.savedIndex = null;
      this.savedDistance = 0;
      this.saveDepth -= 1;
    });
  }

  resetScroll() {
    if (!this.window) {
      return;
    }

    const { origin } = this.props;
    this.window.scrollTop =
      origin === 'top'
        ? 0
        : this.window.scrollHeight - this.window.offsetHeight;
    this.savedIndex = null;
    this.savedDistance = 0;
    this.saveDepth = 0;
  }

  scrollKeyMap(): Map<string, number> {
    const { averageHeight } = this.props;
    return new Map([
      ['ArrowUp', averageHeight],
      ['ArrowDown', averageHeight * -1],
      ['PageUp', this.window!.offsetHeight],
      ['PageDown', this.window!.offsetHeight * -1],
      ['Home', this.window!.scrollHeight],
      ['End', this.window!.scrollHeight * -1],
      ['Space', this.window!.offsetHeight * -1],
    ]);
  }

  startOffset() {
    const { data, keyEq, origin } = this.props;
    const { visibleItems } = this.state;
    const startIndex = visibleItems?.[0];
    if (!startIndex) {
      return 0;
    }
    const dataList =
      origin === 'top' ? Array.from(data) : Array.from(data).reverse();
    const offset = dataList.findIndex(([i]) => keyEq(i, startIndex));
    if (offset === -1) {
      // TODO: revisit when we remove nodes for any other reason than
      // pending indices being removed
      return 0;
    }
    return offset;
  }

  /*
   *  Updates the `startOffset` and adjusts visible items accordingly.
   *  Saves the scroll positions before repainting and restores it afterwards
   */
  updateVisible(newOffset: number) {
    if (!this.window) {
      return;
    }
    log('reflow', `from: ${this.startOffset()} to: ${newOffset}`);

    const { data, origin } = this.props;
    const keys = origin === 'top' ? data.keys() : data.keys().reverse();
    const visibleItems = keys.slice(newOffset, newOffset + this.pageSize);

    this.save();

    this.setState({
      visibleItems,
    });
    requestAnimationFrame(() => {
      this.restore();
    });
  }

  render() {
    const { visibleItems } = this.state;

    const {
      data,
      origin = 'top',
      renderer,
      style,
      keyEq,
      keyBunt,
      keyToString,
    } = this.props;

    const isTop = origin === 'top';

    const children = visibleItems;

    const atStart = keyEq(
      data.peekSmallest()?.[0] ?? keyBunt,
      visibleItems?.[0] || keyBunt
    );
    const atEnd = keyEq(
      data.peekLargest()?.[0] ?? keyBunt,
      visibleItems?.[visibleItems.length - 1] || keyBunt
    );

    const scrollBoxMargin = isTop
      ? { width: 'calc(100% - 4px)', marginBottom: 'auto' }
      : { width: 'calc(100% - 4px)', marginTop: 'auto' };

    return (
      <>
        <Scrollbar
          style={{
            top: isTop ? '0' : undefined,
            bottom: !isTop ? '0' : undefined,
            backgroundColor: 'lightGray',
          }}
          ref={this.setScrollRef}
        />
        <ScrollbarLessBox
          ref={this.setWindow}
          onScroll={this.onScroll}
          className="hide-scroll flex h-full flex-col"
          style={{
            ...style,
            WebkitOverflowScrolling: 'auto',
            overflowY: 'scroll',
          }}
        >
          <div style={scrollBoxMargin}>
            {(isTop ? !atEnd : !atStart) && (
              <Center>
                <LoadingSpinner />
              </Center>
            )}
            <VirtualContext.Provider value={this.shiftLayout}>
              {children.map((index) => (
                <VirtualChild<K>
                  key={keyToString(index)}
                  setRef={this.setRef}
                  index={index}
                  scrollWindow={this.window}
                  renderer={renderer}
                />
              ))}
            </VirtualContext.Provider>
            {(!isTop ? !atEnd : !atStart) && (
              <Center height={5}>
                <LoadingSpinner />
              </Center>
            )}
          </div>
        </ScrollbarLessBox>
      </>
    );
  }
}
