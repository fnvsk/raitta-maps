import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useUi, type Snap } from '@/state/ui';

const PEEK_PX = 236;

const PEEK_MAX_RATIO = 0.42;

const MINI_PX = 92;
const HALF_RATIO = 0.6;
const TOP_GAP_PX = 10;
const HANDLE_PX = 22;
const TAB_BAR_PX = 58;
const FLICK_PX_PER_MS = 0.25;

const DRAG_SLOP_PX = 6;

const FOLD_GAP_PX = 6;

function safeArea(edge: 'top' | 'bottom') {
  const probe = document.createElement('div');
  probe.style.cssText = `position:fixed;visibility:hidden;height:var(--safe-${edge})`;
  document.body.append(probe);
  const height = probe.offsetHeight;
  probe.remove();
  return height;
}

function useViewportHeight() {
  const [height, setHeight] = useState(window.innerHeight);
  useEffect(() => {
    const shell = document.querySelector('.app-shell');
    if (!shell) return;
    const observer = new ResizeObserver(() => setHeight(shell.clientHeight));
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);
  return height;
}

export function useSheetSnap(snap: Snap) {
  const setSnap = useUi((s) => s.setSnap);
  useLayoutEffect(() => setSnap(snap), [snap, setSnap]);
}

interface DragState {
  startX: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  moved: boolean;
  pointerId: number;

  onHandle: boolean;
}

export function BottomSheet({
  children,
  withTabBar,
  routeKey,
  driving = false,
}: {
  children: ReactNode;
  withTabBar: boolean;
  routeKey: string;

  driving?: boolean;
}) {
  const viewport = useViewportHeight();
  const snap = useUi((s) => s.snap);
  const setSnap = useUi((s) => s.setSnap);
  const setSheetInset = useUi((s) => s.setSheetInset);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(PEEK_PX);

  const [fold, setFold] = useState<number | null>(null);
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => {
      setContentHeight(element.offsetHeight);
      const marker = element.querySelector('[data-sheet-fold]');
      setFold(marker ? marker.getBoundingClientRect().bottom - element.getBoundingClientRect().top : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [routeKey]);

  const heights = useMemo(() => {
    const bottom = safeArea('bottom');
    const tabBar = withTabBar ? TAB_BAR_PX + bottom : 0;
    const full = viewport - safeArea('top') - TOP_GAP_PX - tabBar;

    const peekFit = Math.max(MINI_PX, HANDLE_PX + contentHeight + (withTabBar ? 16 : bottom + 16));
    return {
      mini: fold !== null ? HANDLE_PX + fold + FOLD_GAP_PX + (withTabBar ? 0 : bottom) : MINI_PX + bottom,

      peek: Math.min(peekFit, Math.round(viewport * PEEK_MAX_RATIO), full),

      half: Math.max(Math.min(peekFit, Math.round(viewport * PEEK_MAX_RATIO), full), Math.min(Math.round(viewport * HALF_RATIO) - tabBar, peekFit)),
      full: Math.max(Math.min(peekFit, Math.round(viewport * PEEK_MAX_RATIO), full), Math.min(full, peekFit)),
      tabBar,

      contentBottom: withTabBar ? 16 : bottom + 16,
    };
  }, [viewport, withTabBar, contentHeight, fold]);

  useEffect(() => setSheetInset(heights[snap] + heights.tabBar), [heights, snap, setSheetInset]);
  useEffect(() => {
    scroller.current?.scrollTo(0, 0);
  }, [routeKey]);

  const height = dragHeight ?? heights[snap];

  const order: Snap[] = driving
    ? ['mini', 'peek']
    : routeKey === '/routes'
      ? ['mini', 'half', 'full']
      : fold !== null
        ? ['mini', 'peek', 'half', 'full']
        : ['peek', 'half', 'full'];

  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select')) return;
    const scrolled = (scroller.current?.scrollTop ?? 0) > 0;
    if (!target.closest('[data-sheet-drag]') && (snap === 'full' || scrolled)) return;
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      startHeight: heights[snap],
      lastY: e.clientY,
      lastTime: e.timeStamp,
      velocity: 0,
      moved: false,
      pointerId: e.pointerId,
      onHandle: !!target.closest('[data-sheet-handle]'),
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const delta = d.startY - e.clientY;

    if (!d.moved && Math.abs(e.clientX - d.startX) > DRAG_SLOP_PX && Math.abs(e.clientX - d.startX) > Math.abs(delta)) {
      drag.current = null;
      return;
    }
    if (!d.moved && Math.abs(delta) < DRAG_SLOP_PX) return;
    if (!d.moved) {
      d.moved = true;

      e.currentTarget.setPointerCapture(d.pointerId);
    }
    const dt = e.timeStamp - d.lastTime;
    if (dt > 0) d.velocity = (d.lastY - e.clientY) / dt;
    d.lastY = e.clientY;
    d.lastTime = e.timeStamp;
    setDragHeight(Math.max(heights[order[0]] * 0.8, Math.min(heights.full, d.startHeight + delta)));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    suppressClick.current = d.moved;
    if (!d.moved) {
      if (d.onHandle) setSnap(order[(order.indexOf(snap) + 1) % order.length]);
      return;
    }
    const current = dragHeight ?? heights[snap];
    let target = order.reduce((best, s) =>
      Math.abs(heights[s] - current) < Math.abs(heights[best] - current) ? s : best,
    );
    if (Math.abs(d.velocity) > FLICK_PX_PER_MS) {
      const from = order.indexOf(snap);
      target = order[Math.max(0, Math.min(order.length - 1, from + Math.sign(d.velocity)))];
    }
    setSnap(target);
    setDragHeight(null);
  };

  return (
    <section
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}

      onClickCapture={(e) => {
        if (suppressClick.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressClick.current = false;
        }
      }}
      className="surface-sheet absolute inset-x-0 z-20 flex flex-col overflow-hidden rounded-t-panel select-none"
      style={{
        bottom: withTabBar ? 'var(--tabbar-height)' : 0,
        height: heights.full,
        transform: `translateY(${heights.full - height}px)`,
        transition: dragHeight === null ? 'transform 0.42s cubic-bezier(0.25, 1.2, 0.4, 1)' : 'none',
      }}
    >
      <div data-sheet-drag data-sheet-handle className="flex shrink-0 cursor-grab touch-none justify-center pt-2" style={{ height: HANDLE_PX }}>
        <span className="h-[5px] w-10 rounded-full bg-(--muted-icon) opacity-40" />
      </div>
      <div
        ref={scroller}
        className={`px-4 pb-6 ${snap === 'full' ? 'scroll-area' : 'overflow-hidden'}`}
        style={{ height: heights[snap] - HANDLE_PX, paddingBottom: heights.contentBottom, touchAction: snap === 'full' ? 'pan-y' : 'none' }}
      >
        <div ref={content} data-folded={snap === 'mini' && fold !== null ? '' : undefined}>
          {children}
        </div>
      </div>
    </section>
  );
}
