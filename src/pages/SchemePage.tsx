import { ArrowRight, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { BackButton, Card, Message, RowSkeleton, Segmented } from '@/components/ui';
import { buildNetwork, rideOf, routeOnScheme, type Point, type SchemeNetwork, type SchemeRoute } from '@/core/scheme';
import { BADGE_H, CHANGE_RIM, drawScheme, smoothOutline, FONT, LINE_WIDTH, SIGNS, STOP_R, stationSpan, type StationSigns } from '@/core/schemeDraw';
import { picturesFor, schemeFor, type SchemeLayout } from '@/core/schemeHand';
import type { Mode } from '@/core/types';
import { useAllShapes, useLandmarks, useLines, usePatterns, useStops } from '@/data/hooks';
import { dataUrl } from '@/platform';
import { useKeptState } from '@/state/kept';
import { useUi } from '@/state/ui';
import { useIsDesktop } from '@/theme';

type Kind = 'metro' | 'tram' | 'rail';
const MODE_OF: Record<Kind, Mode> = { metro: 'metro', tram: 'tram', rail: 'train' };
const KINDS: Kind[] = ['metro', 'tram', 'rail'];
const FADE_MS = 360;
const ZOOM_MS = 520;
const MIN_ZOOM = 0.3;

const START_ZOOM = 1.15;
const MAX_ZOOM = 5;

const LAYER_PAD = 80;

const LAYER_MAX_PX = 9000;

const SETTLE_MS = 140;
const ZOOM_ANIM_MS = 260;
const DOUBLE_TAP_MS = 320;

const TAP_SLOP = 6;

const GLIDE_FRICTION = 0.94;

let measureContext: CanvasRenderingContext2D | null = null;
function measureName(text: string, bold: boolean) {
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return text.length * 6.6 * (bold ? 1.08 : 1);
  measureContext.font = `${bold ? 700 : 500} ${FONT}px "Inter Variable", system-ui, sans-serif`;
  return measureContext.measureText(text).width - text.length * 0.1;
}

interface View {
  k: number;
  x: number;
  y: number;
}

function fitView(points: Point[], area: { left: number; top: number; width: number; height: number }): View {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((area.width - 80) / Math.max(1, x1 - x0), (area.height - 80) / Math.max(1, y1 - y0))));
  return { k, x: area.left + area.width / 2 - ((x0 + x1) / 2) * k, y: area.top + area.height / 2 - ((y0 + y1) / 2) * k };
}

export function SchemeCanvas({
  inline = false,
  freeArea,
  controls = false,
  network,
  layout,
  signs,
  visible,
  route,
  from,
  to,
  focus,
  onStation,
}: {
  network: SchemeNetwork;
  layout: SchemeLayout;

  signs: Record<string, StationSigns & { sight?: string }>;

  visible: boolean;
  route: SchemeRoute | null;
  from: string | null;
  to: string | null;

  focus: string | null;
  onStation: (id: string) => void;

  inline?: boolean;

  freeArea?: { left: number; top: number; width: number; height: number };

  controls?: boolean;
}) {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  const sheetInset = useUi((s) => s.sheetInset);
  const navigate = useNavigate();
  const scheme = layout.pos;
  const drawn = useMemo(() => drawScheme(network, layout.pos, { sides: layout.sides, signs, measure: measureName }), [network, layout, signs]);

  const moving = drawn;

  const area = useMemo(
    () => freeArea ?? { left: desktop ? 432 : 0, top: desktop ? 0 : 64, width: window.innerWidth - (desktop ? 432 : 0), height: window.innerHeight - (desktop ? 0 : 64) - (desktop ? 0 : sheetInset) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [desktop, network, freeArea?.left, freeArea?.top, freeArea?.width, freeArea?.height],
  );

  const fitted = useMemo(() => {
    const [x0, y0, x1, y1] = drawn.bounds;
    const whole = fitView([[x0, y0], [x1, y1]], area);
    if (whole.k >= START_ZOOM) {
      const k = Math.min(whole.k, 1.6);
      return { k, x: area.left + area.width / 2 - ((x0 + x1) / 2) * k, y: area.top + area.height / 2 - ((y0 + y1) / 2) * k };
    }
    const busiest = Math.max(...network.stations.map((st) => st.lines.length));
    const hubs = network.stations.filter((st) => st.lines.length === busiest);
    const cx = hubs.reduce((sum, st) => sum + scheme[st.id][0], 0) / hubs.length;
    const cy = hubs.reduce((sum, st) => sum + scheme[st.id][1], 0) / hubs.length;
    return { k: START_ZOOM, x: area.left + area.width / 2 - cx * START_ZOOM, y: area.top + area.height / 2 - cy * START_ZOOM };
  }, [drawn, area, network, scheme]);

  const [view, setView] = useState<View>(fitted);
  const live = useRef<View>(fitted);
  const layer = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const glide = useRef(0);
  const [bx0, by0, bx1, by1] = drawn.bounds;
  const box = { x: bx0 - LAYER_PAD, y: by0 - LAYER_PAD, w: bx1 - bx0 + LAYER_PAD * 2, h: by1 - by0 + LAYER_PAD * 2 };

  const drawnAt = Math.min(view.k, LAYER_MAX_PX / Math.max(box.w, box.h));
  const drawnAtRef = useRef(drawnAt);
  drawnAtRef.current = drawnAt;
  const place = (v: View) => `translate3d(${v.x + box.x * v.k}px, ${v.y + box.y * v.k}px, 0) scale(${v.k / drawnAtRef.current})`;
  const show = (v: View, moving = true) => {
    live.current = v;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = layer.current;
      if (!el) return;

      if (moving) el.style.willChange = 'transform';
      el.style.transform = place(live.current);
    });
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (layer.current) layer.current.style.willChange = 'auto';
      setView(live.current);
    }, SETTLE_MS);
  };
  const clampK = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));
  const zoomAt = (k: number, at: Point, from = live.current): View => {
    const nk = clampK(k);
    const f = nk / from.k;
    return { k: nk, x: at[0] - (at[0] - from.x) * f, y: at[1] - (at[1] - from.y) * f };
  };
  const stopGlide = () => cancelAnimationFrame(glide.current);

  const animateTo = (target: View) => {
    stopGlide();
    const from = live.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ZOOM_ANIM_MS);
      const e = 1 - Math.pow(1 - t, 3);
      const k = from.k * Math.pow(target.k / from.k, e);
      show({ k, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e });
      if (t < 1) glide.current = requestAnimationFrame(step);
    };
    glide.current = requestAnimationFrame(step);
  };
  useEffect(() => {
    stopGlide();
    show(fitted, false);
    setView(fitted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitted]);

  useEffect(() => {
    if (!route) return;
    const pts = route.stations.map((id) => scheme[id]).filter(Boolean);
    if (!pts.length) return;
    const v = fitView(pts, { ...area, left: area.left + 40, top: area.top + 40, width: area.width - 80, height: area.height - 80 });
    animateTo({ ...v, ...(v.k > 1.8 ? zoomAt(1.8, [area.left + area.width / 2, area.top + area.height / 2], v) : {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      cancelAnimationFrame(glide.current);
      clearTimeout(settle.current);
    },
    [],
  );

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ view: View; dist: number; mid: Point } | null>(null);
  const moved = useRef(false);
  const trail = useRef<{ t: number; p: Point }[]>([]);
  const lastTap = useRef<{ t: number; p: Point } | null>(null);
  const midOf = (pts: Point[]): Point => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  const startGesture = () => {
    const pts = [...pointers.current.values()].slice(-2);
    gesture.current = { view: live.current, dist: pts.length > 1 ? Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) : 0, mid: midOf(pts) };
    trail.current = [];
  };
  const onDown = (e: ReactPointerEvent) => {
    stopGlide();
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.current.size === 1) moved.current = false;
    startGesture();
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;

    if (e.pointerType === 'mouse' && e.buttons === 0) {
      onUp(e.nativeEvent);
      return;
    }
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);

    const pts = [...pointers.current.values()].slice(-2);
    const mid = midOf(pts);
    const start = gesture.current;
    const scale = pts.length > 1 && start.dist > 0 ? Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) / start.dist : 1;
    if (!moved.current && Math.hypot(mid[0] - start.mid[0], mid[1] - start.mid[1]) < TAP_SLOP && Math.abs(scale - 1) < 0.02) return;

    if (!moved.current) {
      for (const id of pointers.current.keys()) {
        try {
          (e.currentTarget as Element).setPointerCapture(id);
        } catch {
        }
      }
    }
    moved.current = true;
    const k = clampK(start.view.k * scale);
    const f = k / start.view.k;
    show({ k, x: mid[0] - (start.mid[0] - start.view.x) * f, y: mid[1] - (start.mid[1] - start.view.y) * f });
    const now = performance.now();
    trail.current = [...trail.current.filter((s) => now - s.t < 100), { t: now, p: mid }];
  };
  const onUp = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const wasPan = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) {
      startGesture();
      return;
    }
    gesture.current = null;
    const now = performance.now();
    if (!moved.current) {
      const p: Point = [e.clientX, e.clientY];
      const onStationTarget = (e.target as Element).closest?.('[data-hit]');
      const prev = lastTap.current;
      if (!onStationTarget && prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(p[0] - prev.p[0], p[1] - prev.p[1]) < 40) {
        lastTap.current = null;
        animateTo(zoomAt(live.current.k * 2 > MAX_ZOOM * 0.98 ? START_ZOOM : live.current.k * 2, p));
      } else lastTap.current = { t: now, p };
      return;
    }

    const samples = trail.current.filter((s) => now - s.t < 100);
    if (!wasPan || samples.length < 2) return;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = Math.max(16, last.t - first.t);
    let vx = (last.p[0] - first.p[0]) / dt;
    let vy = (last.p[1] - first.p[1]) / dt;
    if (Math.hypot(vx, vy) < 0.25) return;
    let prevT = now;
    const step = (t: number) => {
      const ms = Math.min(32, t - prevT);
      prevT = t;
      const decay = Math.pow(GLIDE_FRICTION, ms / 16);
      vx *= decay;
      vy *= decay;
      const v = live.current;
      show({ k: v.k, x: v.x + vx * ms, y: v.y + vy * ms });
      if (Math.hypot(vx, vy) > 0.02) glide.current = requestAnimationFrame(step);
    };
    glide.current = requestAnimationFrame(step);
  };

  const onUpRef = useRef(onUp);
  onUpRef.current = onUp;
  useEffect(() => {
    const end = (e: PointerEvent) => onUpRef.current(e);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);
  const onWheel = (e: ReactWheelEvent) => {
    stopGlide();

    const speed = e.ctrlKey ? 0.01 : 0.0018;
    show(zoomAt(live.current.k * Math.exp(-e.deltaY * speed), [e.clientX, e.clientY]));
  };

  const routeLines = new Set(route?.legs.map((leg) => leg.line));
  const routeStations = new Set(route?.stations);
  const ink = 'var(--ink)';
  const paper = 'var(--bg)';
  const routeColours = new Set(route?.legs.map((leg) => network.colors[leg.line]));
  const focusStations = useMemo(() => new Set(focus ? (network.runs[focus] ?? []).flat() : []), [network, focus]);

  const oneColour = new Set(Object.values(network.colors)).size === 1;
  const fadedColour = (colour: string) => (route ? !routeColours.has(colour) : focus ? oneColour || colour !== network.colors[focus] : false);
  const fadedStation = (id: string) => (route ? !routeStations.has(id) : focus ? !focusStations.has(id) : false);

  const canvas = (
    <div
      className="absolute inset-0 z-[2] touch-none select-none"

      style={{
        background: paper,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.96)',
        transformOrigin: '50% 40%',
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${ZOOM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        willChange: 'opacity, transform',
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onWheel={onWheel}
    >
      <div ref={layer} className="absolute top-0 left-0 origin-top-left" style={{ width: box.w * drawnAt, height: box.h * drawnAt, transform: place(live.current) }}>
      <svg width={box.w * drawnAt} height={box.h * drawnAt} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="block overflow-visible">
        <g>
          <g fill="var(--scheme-water)" stroke="var(--scheme-water)" strokeLinejoin="round" strokeLinecap="round">
            {layout.water.areas.map((area, i) => (
              <path key={`water-${i}`} d={smoothOutline(area, true)} strokeWidth={8} />
            ))}
            {layout.water.rivers.map((river, i) => (
              <path key={`river-${i}`} d={smoothOutline(river.path, false)} fill="none" strokeWidth={river.width} />
            ))}
          </g>
          {moving.lines.map((line) =>
            line.paths.map((d, i) => (
              <path
                key={`${line.line}-${i}`}
                d={d}
                fill="none"
                stroke={line.color}
                strokeWidth={LINE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={fadedColour(line.color) ? 0.14 : route ? 0.35 : 1}
              />
            )),
          )}
          {!route &&
            focus &&
            oneColour &&
            (network.runs[focus] ?? []).map((run, i) => (
              <polyline
                key={`focus-${i}`}
                points={run.map((id) => scheme[id].join(',')).join(' ')}
                fill="none"
                stroke={network.colors[focus]}
                strokeWidth={LINE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          {route &&
            route.legs.map((leg, i) => (
              <polyline
                key={`leg-${i}`}
                points={leg.stations.map((id) => (moving === drawn ? scheme[id] : (moving.stations.find((s) => s.id === id)?.centre ?? scheme[id])).join(',')).join(' ')}
                fill="none"
                stroke={network.colors[leg.line]}
                strokeWidth={LINE_WIDTH + 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          {moving.stations.map((station) => {
            const [a, b] = stationSpan(station);
            const dim = fadedStation(station.id);
            const picked = station.id === from ? '#12A150' : station.id === to ? '#E11D48' : null;
            return (
              <g key={station.id} opacity={dim ? 0.35 : 1}>
                {station.change ? (
                  <>
                    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ink} strokeWidth={LINE_WIDTH + CHANGE_RIM * 2 + 3} strokeLinecap="round" />
                    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#FFFFFF" strokeWidth={LINE_WIDTH + 3} strokeLinecap="round" />
                  </>
                ) : station.shared ? (
                  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#FFFFFF" strokeWidth={STOP_R * 2} strokeLinecap="round" />
                ) : (
                  <circle cx={a[0]} cy={a[1]} r={STOP_R} fill="#FFFFFF" />
                )}
                {picked && <circle cx={station.centre[0]} cy={station.centre[1]} r={10} fill={picked} stroke="#FFFFFF" strokeWidth={3} />}
              </g>
            );
          })}
          {drawn.badges.map((badge, i) => (
              <g key={`badge-${i}`} opacity={(route && !routeLines.has(badge.line)) || (!route && focus && badge.line !== focus) ? 0.25 : 1}>
                <rect x={badge.x - badge.width / 2} y={badge.y - BADGE_H / 2} width={badge.width} height={BADGE_H} rx={6} fill={badge.color} />
                <text x={badge.x} y={badge.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#FFFFFF" style={{ fontFamily: 'Inter Variable, system-ui, sans-serif' }}>
                  {badge.line}
                </text>
              </g>
            ))}
          {drawn.labels.map((label) => {
              const sight = signs[label.id]?.sight;
              return (
                <g key={label.id} opacity={fadedStation(label.id) ? 0.3 : 1}>
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor={label.anchor}
                    fontSize={FONT}
                    letterSpacing={-0.1}
                    fontWeight={label.bold || routeStations.has(label.id) ? 700 : 500}
                    fill={ink}

                    stroke={paper}
                    strokeWidth={3.5}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    style={{ fontFamily: 'Inter Variable, system-ui, sans-serif' }}
                  >
                    {label.text}
                  </text>
                  {label.signs.map((sign, i) =>
                    sign.kind ? (
                      <g key={i}>
                        <title>{t(`scheme.place.${sign.kind}`)}</title>
                        <rect x={sign.x - sign.size / 2} y={sign.y - sign.size / 2} width={sign.size} height={sign.size} rx={4} fill={SIGNS[sign.kind].color} />
                        <path d={SIGNS[sign.kind].path} fill="#FFFFFF" fillRule="evenodd" transform={`translate(${sign.x - 4.8} ${sign.y - 4.8}) scale(0.8)`} />
                      </g>
                    ) : sign.picture ? (
                      <g
                        key={i}
                        className={sight ? 'cursor-pointer' : undefined}
                        onClick={(e) => {
                          if (!sight) return;
                          e.stopPropagation();
                          if (!moved.current) navigate(`/place/wd/${sight}`);
                        }}
                      >
                        <title>{sign.title}</title>
                        <defs>
                          <mask id={`pic-${label.id}`} maskContentUnits="userSpaceOnUse">
                            <image href={sign.picture} x={sign.x - sign.size / 2} y={sign.y - sign.size / 2} width={sign.size} height={sign.size} />
                          </mask>
                        </defs>
                        <rect x={sign.x - sign.size / 2} y={sign.y - sign.size / 2} width={sign.size} height={sign.size} fill={ink} opacity={0.82} mask={`url(#pic-${label.id})`} />
                      </g>
                    ) : sign.photo ? (
                      <g
                        key={i}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!moved.current && sight) navigate(`/place/wd/${sight}`);
                        }}
                      >
                        <title>{sign.title}</title>
                        <defs>
                          <clipPath id={`sight-${label.id}`}>
                            <circle cx={sign.x} cy={sign.y} r={sign.size / 2} />
                          </clipPath>
                        </defs>
                        <circle cx={sign.x} cy={sign.y} r={sign.size / 2 + 2} fill="#FFFFFF" stroke="rgba(0,0,0,0.12)" strokeWidth={1} />
                        <image
                          href={sign.photo}
                          x={sign.x - sign.size / 2}
                          y={sign.y - sign.size / 2}
                          width={sign.size}
                          height={sign.size}
                          preserveAspectRatio="xMidYMid slice"
                          clipPath={`url(#sight-${label.id})`}

                          onError={(e) => ((e.currentTarget.parentNode as SVGGElement).style.display = 'none')}
                        />
                      </g>
                    ) : null,
                  )}
                </g>
              );
            })}
          {drawn.stations.map((station) => (
              <circle
                key={`hit-${station.id}`}
                cx={station.centre[0]}
                cy={station.centre[1]}
                r={Math.max(16, 24 / view.k)}
                data-hit
                fill="transparent"
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!moved.current) onStation(station.id);
                }}
              />
            ))}
        </g>
      </svg>
      </div>
      {controls && (
        <div className="absolute z-10 flex flex-col gap-2" style={{ left: area.left + area.width - 60, top: area.top + area.height - 168 }}>
          {[
            { label: '+', icon: <Plus className="size-5" />, act: () => animateTo(zoomAt(live.current.k * 1.6, [area.left + area.width / 2, area.top + area.height / 2])) },
            { label: '−', icon: <Minus className="size-5" />, act: () => animateTo(zoomAt(live.current.k / 1.6, [area.left + area.width / 2, area.top + area.height / 2])) },
            { label: '⤢', icon: <Maximize2 className="size-[18px]" />, act: () => animateTo(fitView([[drawn.bounds[0], drawn.bounds[1]], [drawn.bounds[2], drawn.bounds[3]]], area)) },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              aria-label={b.label}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={b.act}
              className="surface press grid size-11 place-items-center rounded-2xl text-ink"
            >
              {b.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return inline ? canvas : createPortal(canvas, document.getElementById('map-root') ?? document.body);
}

export function SchemePage() {
  const { t, i18n } = useTranslation();
  useSheetSnap('peek');
  const navigate = useNavigate();
  const { kind = 'metro' } = useParams();
  const current = (KINDS.includes(kind as Kind) ? kind : 'metro') as Kind;
  const mode = MODE_OF[current];
  const { data: lines } = useLines();
  const { data: patterns } = usePatterns();
  const { data: stops } = useStops();
  const shapes = useAllShapes();
  const setFocus = useUi((s) => s.setFocus);
  const fitTo = useUi((s) => s.fitTo);
  const [view, setView] = useKeptState<'scheme' | 'city'>('scheme-view', () => 'scheme');
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [focusLine, setFocusLine] = useState<string | null>(null);

  const available = useMemo(() => KINDS.filter((k) => lines?.some((line) => line.mode === MODE_OF[k])), [lines]);
  const network = useMemo(() => (lines && patterns && stops ? buildNetwork(mode, lines, patterns, stops) : null), [mode, lines, patterns, stops]);
  const layout = useMemo(() => (network ? schemeFor(network) : null), [network]);
  const { data: landmarks } = useLandmarks();
  const signs = useMemo(() => {
    if (!network || !layout) return {};

    const pictures = picturesFor(network, landmarks ? Object.values(landmarks).flat() : [], i18n.language);
    const out: Record<string, StationSigns & { sight?: string }> = {};
    for (const station of network.stations) {
      const picture = pictures[station.id];
      const kinds = layout.kinds[station.id];
      if (!kinds && !picture) continue;
      out[station.id] = {
        kinds,
        picture: picture ? { url: dataUrl(`sights/${String(picture.pic).padStart(2, '0')}.png`), title: picture.title } : undefined,
        sight: picture?.wikidata,
      };
    }
    return out;
  }, [network, layout, landmarks, i18n.language]);
  const route = useMemo(() => (network && from && to ? routeOnScheme(network, from, to) : null), [network, from, to]);
  const names = useMemo(() => new Map(network?.stations.map((s) => [s.id, s.name]) ?? []), [network]);
  useEffect(() => {
    setFrom(null);
    setTo(null);
  }, [mode]);

  useEffect(() => {
    if (!network || !patterns) return;
    const rides = network.lines.flatMap((line) => {
      const busiest = patterns.filter((p) => p.line === line).sort((a, b) => b.trips - a.trips)[0];
      const path = busiest && shapes?.[line]?.[busiest.shape];
      return path ? [{ line, path, mode }] : [];
    });
    setFocus({
      journey: {
        rides,
        walks: [],
        markers: network.stations.map((s) => ({ id: s.stops[0], name: s.name, lat: s.lat, lon: s.lon, line: s.lines[0] })),
        lines: network.lines,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, shapes]);

  useEffect(() => {
    if (!network || view !== 'city') return;
    const lons = network.stations.map((s) => s.lon);
    const lats = network.stations.map((s) => s.lat);
    if (lons.length) fitTo([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]);
  }, [network, view, fitTo]);
  useEffect(() => () => setFocus({}), [setFocus]);

  const pick = (id: string) => {
    if (!from || (from && to)) {
      setFrom(id);
      setTo(null);
    } else if (id !== from) setTo(id);
  };

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-2.5 pb-3">
        <BackButton />
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-bold tracking-tight">{t(`scheme.${current}`)}</h1>
      </div>
      <div data-sheet-fold className="mb-3">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'scheme', label: t('scheme.view') },
            { value: 'city', label: t('scheme.inCity') },
          ]}
        />
      </div>
      {available.length > 1 && (
        <div className="mb-3 flex gap-1.5">
          {available.map((k) => (
            <Link
              key={k}
              to={`/scheme/${k}`}
              replace
              className={`press flex h-9 items-center rounded-full px-4 text-[14px] font-semibold ${k === current ? 'primary-fill' : 'bg-raised'}`}
            >
              {t(`scheme.${k}`)}
            </Link>
          ))}
        </div>
      )}

      {!network && <RowSkeleton rows={2} />}
      {network && !network.stations.length && <Message>{t('scheme.none')}</Message>}

      {network && network.stations.length > 0 && (
        <>
          {!from && <p className="mb-3 px-1 text-[14px] text-muted">{t('scheme.hint')}</p>}
          {from && (
            <Card className="mb-3 p-3">
              <div className="flex items-center gap-2 text-[15px] font-semibold">
                <span className="size-3 shrink-0 rounded-full bg-[#12A150]" />
                <span className="min-w-0 truncate">{names.get(from)}</span>
                <ArrowRight className="size-4 shrink-0 text-muted" />
                <span className="size-3 shrink-0 rounded-full bg-[#E11D48]" />
                <span className="min-w-0 flex-1 truncate">{to ? names.get(to) : t('scheme.pickTo')}</span>
                <button
                  type="button"
                  aria-label={t('scheme.reset')}
                  onClick={() => {
                    setFrom(null);
                    setTo(null);
                  }}
                  className="press grid size-8 shrink-0 place-items-center rounded-full bg-raised"
                >
                  <RotateCcw className="size-4" />
                </button>
              </div>
              {route && (
                <>
                  <p className="mt-2 text-[14px] text-muted">{t('scheme.summary', { minutes: route.minutes, stations: route.stations.length - 1, changes: route.legs.length - 1 })}</p>
                  <ol className="mt-2 space-y-1.5">
                    {route.legs.map((leg, i) => (
                      <li key={i} className="flex items-center gap-2 text-[14px]">
                        <span className="grid h-6 min-w-9 place-items-center rounded-[8px] px-1.5 text-[12px] font-bold text-white" style={{ background: network.colors[leg.line] }}>
                          {leg.line}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {names.get(leg.stations[0])} → {names.get(leg.stations.at(-1)!)}
                        </span>
                        <span className="shrink-0 text-muted">{t('scheme.stops', { count: leg.stations.length - 1 })}</span>
                      </li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    onClick={() => {
                      const a = network.stations.find((s) => s.id === from)!;
                      const b = network.stations.find((s) => s.id === to)!;

                      const ride = rideOf(network, route!);
                      navigate(`/routes?${new URLSearchParams({ view: 'plan', toLat: String(b.lat), toLon: String(b.lon), toName: b.name, fromLat: String(a.lat), fromLon: String(a.lon), fromName: a.name, ride })}`);
                    }}
                    className="press primary-fill mt-3 h-11 w-full rounded-full font-semibold"
                  >
                    {t('scheme.plan')}
                  </button>
                </>
              )}
            </Card>
          )}
          <p className="mb-1.5 px-1 text-[12px] font-bold tracking-wide text-muted uppercase">{t('scheme.lines')}</p>
          <div className="flex flex-wrap gap-1.5">
            {network.lines.map((line) => (
              <button
                key={line}
                type="button"
                aria-pressed={focusLine === line}
                onClick={() => setFocusLine(focusLine === line ? null : line)}
                className={`press grid h-8 min-w-11 place-items-center rounded-[10px] px-2.5 text-[13.5px] font-bold text-white transition ${focusLine && focusLine !== line ? 'opacity-35' : ''} ${focusLine === line ? 'ring-2 ring-offset-2 ring-offset-card' : ''}`}
                style={{ background: network.colors[line], ['--tw-ring-color' as string]: network.colors[line] }}
              >
                {line}
              </button>
            ))}
          </div>
          <p className="mt-3 px-1 text-[12px] text-muted">{t('scheme.source')}</p>
        </>
      )}

      {network && layout && network.stations.length > 0 && (
        <SchemeCanvas network={network} layout={layout} signs={signs} visible={view === 'scheme'} route={route} from={from} to={to} focus={focusLine} onStation={pick} />
      )}
    </>
  );
}
