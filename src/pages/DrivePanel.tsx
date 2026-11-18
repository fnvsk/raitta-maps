import { Camera, CarFront, Flag, LocateFixed, Map as MapIcon, Shield, TriangleAlert, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { lowerFirst, nextAnnouncement, type Announcement } from '@/core/driveVoice';
import { bearingFromTo, blendBearing, eventsAlong, fetchCarRoutes, headingAhead, isClosure, pointAlong, progressOn, walksToRoute, type CarRoute, type RouteProgress } from '@/core/driving';
import { distanceM } from '@/core/geo';
import { formatClock } from '@/core/time';
import type { LatLon } from '@/core/types';
import { REPORT_KINDS, alongRoute, sendRoadReport, voteRoadReport, type OnRoute, type ReportKind } from '@/core/roadReports';
import { isSpeeding, limitAt } from '@/core/speedLimits';
import { useClosures, useRoadEvents, useRoadReports, useSpeedCameras, useSpeedLimits } from '@/data/hooks';
import { REPORT_COLORS } from '@/map/vehicleIcons';
import { compassHeading, watchCompass } from '@/map/compass';
import { startLocating } from '@/map/location';
import { useDrive } from '@/state/drive';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';
import { isNativeApp } from '@/platform';
import { useIsDesktop } from '@/theme';
import { maneuverIcon, useDriveTime, useRouteDistance } from './CarPlan';
import { ROAD_EVENT_STYLE, useRoadTitle } from './RoadEventPage';

const OFF_ROUTE_M = 40;
const OFF_ROUTE_FIXES = 2;
const REROUTE_GAP_MS = 12_000;
const ARRIVED_M = 35;
const VIA_REACHED_M = 60;

const THEN_WITHIN_M = 250;
const SPEECH: Record<string, string> = { en: 'en-GB', fi: 'fi-FI', sv: 'sv-SE', ru: 'ru-RU', et: 'et-EE' };

const alertDistance = (speed: number) => (speed > 22 ? 900 : 500);

const ASK_MS = 12_000;
const ASK_PASSED_M = 40;

const SPEEDING_FIXES = 3;
const SPEEDING_GAP_MS = 30_000;

const STILL_MPS = 2.5;

const SNAP_M = 30;
const zoomFor = (speed: number) => (speed > 22 ? 15.2 : speed > 14 ? 15.9 : 16.6);

function speakNow(text: string, language: string) {
  const lang = SPEECH[language] ?? 'en-GB';
  if (isNativeApp) {
    void import('@capacitor-community/text-to-speech').then(({ TextToSpeech }) => TextToSpeech.speak({ text, lang, rate: 1, category: 'playback', queueStrategy: 1 })).catch(() => {});
    return;
  }
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if (isNativeApp) void import('@capacitor-community/text-to-speech').then(({ TextToSpeech }) => TextToSpeech.stop()).catch(() => {});
  else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

let welcomed = 0;

function boundsOf(path: [number, number][]): [number, number, number, number] {
  const lons = path.map((p) => p[0]);
  const lats = path.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function ManeuverBanner({ route, progress, rerouting, children }: { route: CarRoute; progress: RouteProgress | null; rerouting: boolean; children?: ReactNode }) {
  const { t } = useTranslation();
  const distance = useRouteDistance();
  const desktop = useIsDesktop();
  const index = progress?.next ?? 1;
  const maneuver = route.maneuvers[Math.min(index, route.maneuvers.length - 1)];
  const after = route.maneuvers[index + 1];
  const Icon = maneuverIcon(maneuver.type);
  const ThenIcon = after ? maneuverIcon(after.type) : null;
  const showThen = after && after.type !== 4 && maneuver.meters < THEN_WITHIN_M;
  const street = maneuver.stop ? t('drive.stopReached', { n: maneuver.stop }) : (maneuver.streets[0] ?? maneuver.instruction);

  return createPortal(
    <div className={`pointer-events-none fixed z-40 ${desktop ? 'top-4 left-[432px] w-[380px]' : 'safe-top inset-x-0 top-0 px-3 pt-2.5'}`}>
      <div className="pointer-events-auto overflow-hidden rounded-[22px] bg-primary-strong text-white shadow-lg">
        {rerouting ? (
          <p className="px-4 py-4 text-[17px] font-semibold">{t('drive.rerouting')}</p>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3">
            <Icon className="size-11 shrink-0" strokeWidth={2.4} />
            <div className="min-w-0 flex-1">
              <p className="tabular text-[28px] leading-none font-bold">{progress ? distance(progress.toNext) : ''}</p>
              <p className="mt-1 truncate text-[16px] font-semibold opacity-95">{street}</p>
            </div>
          </div>
        )}
        {showThen && ThenIcon && !rerouting && (
          <div className="flex items-center gap-2 bg-black/20 px-4 py-1.5 text-[14px] font-medium">
            {t('drive.then')}
            <ThenIcon className="size-4" />
          </div>
        )}
      </div>
      {children}
    </div>,
    document.body,
  );
}

function ReportGlyph({ kind }: { kind: ReportKind }) {
  const Icon = { camera: Camera, police: Shield, accident: CarFront, hazard: TriangleAlert }[kind];
  return <Icon className="size-4.5" strokeWidth={2.4} />;
}

function LimitSign({ limit, small }: { limit: number; small?: boolean }) {
  return (
    <span
      className={`tabular grid shrink-0 place-items-center rounded-full bg-white font-bold text-[#111] ${small ? 'size-7 border-[3px] text-[12px]' : 'size-14 border-[5px] text-[20px]'}`}
      style={{ borderColor: '#DC2626' }}
    >
      {limit}
    </span>
  );
}

function AheadAlert({ item, distance }: { item: OnRoute; distance: string }) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-auto mt-2 flex w-fit items-center gap-2.5 rounded-full bg-card py-1.5 pr-4 pl-1.5 shadow-lg">
      <span className="grid size-8 place-items-center rounded-full text-white" style={{ background: REPORT_COLORS[item.kind] }}>
        <ReportGlyph kind={item.kind} />
      </span>
      <span className="text-[15px] font-semibold">{t(`drive.reportKinds.${item.kind}`)}</span>
      {item.limit ? <LimitSign limit={item.limit} small /> : null}
      <span className="tabular text-[15px] text-muted">{distance}</span>
    </div>
  );
}

export function DrivePanel() {
  const { t, i18n } = useTranslation();
  const drive = useDrive((s) => s.drive)!;
  const rerouting = useDrive((s) => s.rerouting);
  const arrived = useDrive((s) => s.arrived);
  const location = useUi((s) => s.location);
  const follow = useUi((s) => s.follow);
  const setFollow = useUi((s) => s.setFollow);
  const setFocus = useUi((s) => s.setFocus);
  const setSnap = useUi((s) => s.setSnap);
  const voice = useSettings((s) => s.driveVoice);
  const setVoice = useSettings((s) => s.setDriveVoice);
  const time = useDriveTime();
  const distance = useRouteDistance();
  const roadTitle = useRoadTitle();
  const { data: roadEvents } = useRoadEvents();
  const closures = useClosures();
  const route = drive.route;
  const [progress, setProgress] = useState<RouteProgress | null>(null);
  const [speed, setSpeed] = useState(0);

  const said = useRef(new Set<string>());
  const last = useRef<{ at: LatLon; time: number; segment: number } | null>(null);
  const offFixes = useRef(0);
  const lastReroute = useRef(0);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const say = (text: string) => {
    if (voiceRef.current) speakNow(text, i18n.language);
  };

  const heading = useRef<number | undefined>(undefined);
  const speedRef = useRef(0);
  const turnTo = (target: number, weight: number) => {
    heading.current = heading.current === undefined ? target : blendBearing(heading.current, target, weight);
    return heading.current;
  };
  const shown = useRef<LatLon | null>(null);
  const showCar = (at: LatLon) => {
    shown.current = at;
    useUi.getState().setDriveCamera({ lat: at.lat, lon: at.lon, bearing: heading.current ?? 0, zoom: zoomFor(speedRef.current) });
  };

  const findNewRoute = async (from: LatLon, reason: string) => {
    lastReroute.current = Date.now();
    useDrive.getState().setRerouting(true);
    try {
      const [best] = await fetchCarRoutes({ from, to: drive.destination, via: useDrive.getState().drive?.via, language: i18n.language, avoid: closures.avoid, heading: heading.current, alternates: 0 });
      said.current = new Set();
      last.current = { at: from, time: Date.now(), segment: 0 };
      offFixes.current = 0;
      useDrive.getState().reroute(best);
      say(reason);
    } catch {
      useDrive.getState().setRerouting(false);
    }
  };

  useEffect(() => {
    if (!location) startLocating();
    setFollow(true);
    setSnap('peek');
    let lock: WakeLockSentinel | undefined;
    const keepAwake = () => {
      if (document.visibilityState === 'visible') void navigator.wakeLock?.request('screen').then((sentinel) => (lock = sentinel)).catch(() => {});
    };
    keepAwake();
    document.addEventListener('visibilitychange', keepAwake);
    const start = useUi.getState().location;
    heading.current = compassHeading() ?? (start ? headingAhead(route, progressOn(route, start, 0).along) : headingAhead(route, 0));
    if (start) showCar(start);

    const stopCompass = watchCompass((facing) => {
      if (speedRef.current > STILL_MPS || !shown.current) return;
      turnTo(facing, 0.25);
      showCar(shown.current);
    });
    const first = route.maneuvers[0];
    if (first && welcomed !== drive.startedAt) {
      welcomed = drive.startedAt;
      say([first.pre ?? first.instruction, first.post].filter(Boolean).join(' '));
    }
    return () => {
      stopCompass();
      setFollow(false);
      useUi.getState().setDriveCamera(null);
      document.removeEventListener('visibilitychange', keepAwake);
      void lock?.release().catch(() => {});
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drive.startedAt]);

  useEffect(() => {
    setFocus({ carRoutes: { paths: [route.path], selected: 0 }, roadEvents: true, drive: true, carWalks: walksToRoute(route, null, drive.destination), carStops: drive.via });
  }, [route, setFocus, drive.destination, drive.via]);
  useEffect(() => () => setFocus({}), [setFocus]);

  useEffect(() => {
    if (!location || arrived) return;
    const now = Date.now();
    const previous = last.current;
    const here = progressOn(route, location, previous?.segment ?? 0);
    if (previous) {
      const seconds = (now - previous.time) / 1000;
      const moved = distanceM(previous.at, location);
      if (seconds > 0.5) {
        speedRef.current = speedRef.current * 0.6 + (moved / seconds) * 0.4;
        setSpeed(speedRef.current);
      }

      if (moved > 8 && here.off >= OFF_ROUTE_M) turnTo(bearingFromTo(previous.at, location), 0.5);
    }
    last.current = { at: location, time: now, segment: here.off < OFF_ROUTE_M ? here.segment : (previous?.segment ?? 0) };

    const nextVia = useDrive.getState().drive?.via?.[0];
    if (nextVia && distanceM(location, nextVia) < VIA_REACHED_M) useDrive.getState().passVia();
    setProgress(here);

    if (here.remaining < ARRIVED_M || distanceM(location, drive.destination) < ARRIVED_M) {
      useDrive.getState().setArrived();
      say(route.maneuvers[route.maneuvers.length - 1]?.pre ?? t('drive.arrived'));
      return;
    }
    if (here.off > OFF_ROUTE_M) {
      offFixes.current += 1;
      if (offFixes.current >= OFF_ROUTE_FIXES && now - lastReroute.current > REROUTE_GAP_MS && !useDrive.getState().rerouting) {
        void findNewRoute(location, t('drive.rerouted'));
      }
      return;
    }
    offFixes.current = 0;

    if (speedRef.current > STILL_MPS || compassHeading() === null) turnTo(headingAhead(route, here.along, 40), 0.55);

    const announcement: Announcement | null = nextAnnouncement(route, here, speed, said.current);
    if (announcement) {
      said.current.add(announcement.key);
      const { maneuver } = announcement;
      say(
        announcement.cue === 'far'
          ? t('drive.inDistance', { distance: distance(announcement.distance), instruction: lowerFirst(maneuver.stop ? t('drive.stopReached', { n: maneuver.stop }) : (maneuver.alert ?? maneuver.pre ?? maneuver.instruction)) })
          : maneuver.stop
            ? t('drive.stopReached', { n: maneuver.stop })
            : (maneuver.pre ?? maneuver.instruction),
      );
    }

    showCar(here.off < SNAP_M ? pointAlong(route, here.along) : location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, route]);

  const ahead = useMemo(() => {
    const along = progress?.along ?? 0;
    return eventsAlong(route, roadEvents?.events ?? []).filter((event) => {
      const point = event.point ?? event.lines?.[0]?.[0];
      return point ? progressOn(route, { lon: point[0], lat: point[1] }, 0).along >= along : true;
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, roadEvents]);

  const knownClosures = useRef<{ route: CarRoute | null; ids: Set<string> }>({ route: null, ids: new Set() });
  useEffect(() => {
    const ids = ahead.filter(isClosure).map((event) => event.id);
    if (knownClosures.current.route !== route) {
      knownClosures.current = { route, ids: new Set(ids) };
      return;
    }
    const fresh = ids.filter((id) => !knownClosures.current.ids.has(id));
    if (!fresh.length || !location) return;
    for (const id of fresh) knownClosures.current.ids.add(id);
    void findNewRoute(location, t('drive.closureAhead'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahead]);

  const { data: limits } = useSpeedLimits(route);
  const { data: cameras } = useSpeedCameras();
  const { data: reports } = useRoadReports();
  const onRoute = useMemo(() => alongRoute(route, cameras ?? [], reports ?? []), [route, cameras, reports]);
  const along = progress?.along ?? 0;
  const limit = limits ? limitAt(limits, along) : 0;
  const kmh = speed * 3.6;
  const speeding = isSpeeding(kmh, limit);
  const nextAhead = onRoute.find((item) => item.along > along && item.along - along < alertDistance(speed));

  const told = useRef(new Set<string>());
  useEffect(() => {
    if (!nextAhead || told.current.has(nextAhead.key)) return;
    told.current.add(nextAhead.key);
    const kind = lowerFirst(t(`drive.reportKinds.${nextAhead.kind}`));
    const meters = distance(Math.round((nextAhead.along - along) / 50) * 50);
    say(nextAhead.limit ? t('drive.aheadVoiceLimit', { distance: meters, kind, limit: nextAhead.limit }) : t('drive.aheadVoice', { distance: meters, kind }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextAhead?.key]);

  const overFixes = useRef(0);
  const lastWarning = useRef(0);
  useEffect(() => {
    overFixes.current = speeding ? overFixes.current + 1 : 0;
    if (overFixes.current >= SPEEDING_FIXES && Date.now() - lastWarning.current > SPEEDING_GAP_MS) {
      lastWarning.current = Date.now();
      say(t('drive.slowDown', { limit }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const [ask, setAsk] = useState<OnRoute | null>(null);
  const asked = useRef(new Set<string>());
  useEffect(() => {
    const passed = onRoute.find((item) => item.id && !asked.current.has(item.id) && along - item.along > ASK_PASSED_M && along - item.along < 500);
    if (!passed) return;
    asked.current.add(passed.id!);
    setAsk(passed);
  }, [along, onRoute]);
  useEffect(() => {
    if (!ask) return;
    const timer = setTimeout(() => setAsk(null), ASK_MS);
    return () => clearTimeout(timer);
  }, [ask]);
  const answer = (there: boolean) => {
    if (ask?.id) void voteRoadReport(ask.id, there).catch(() => {});
    setAsk(null);
  };

  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 3500);
    return () => clearTimeout(timer);
  }, [note]);
  const report = (kind: ReportKind) => {
    setReporting(false);
    if (!location) return;
    sendRoadReport(kind, location).then(
      () => setNote(t('drive.reported')),
      () => setNote(t('drive.reportFailed')),
    );
  };

  const remainingSeconds = progress ? route.seconds * (progress.remaining / Math.max(1, route.meters)) : route.seconds;
  const stop = () => useDrive.getState().stop();
  const overview = () => {
    setFollow(false);
    useUi.getState().setDriveCamera(null);
    useUi.getState().fitTo(boundsOf(route.path));
  };

  if (arrived) {
    return (
      <div className="py-2 text-center">
        <p className="text-[22px] font-bold">{t('drive.arrivedTitle')}</p>
        <p className="mt-1 truncate text-muted">{drive.destinationName}</p>
        <button type="button" onClick={stop} className="press primary-fill mt-4 h-12 w-full rounded-full font-semibold">
          {t('common.close')}
        </button>
      </div>
    );
  }

  return (
    <>
      <ManeuverBanner route={route} progress={progress} rerouting={rerouting}>
        {nextAhead && !rerouting && <AheadAlert item={nextAhead} distance={distance(nextAhead.along - along)} />}
      </ManeuverBanner>
      {ask && (
        <div className="mb-3 flex items-center gap-2 rounded-card bg-raised p-2 pl-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full text-white" style={{ background: REPORT_COLORS[ask.kind] }}>
            <ReportGlyph kind={ask.kind} />
          </span>
          <span className="min-w-0 flex-1 text-[15px] font-semibold">{t('drive.stillThere', { kind: t(`drive.reportKinds.${ask.kind}`) })}</span>
          <button type="button" onClick={() => answer(true)} className="press h-10 rounded-full bg-emerald-600 px-4 font-semibold text-white">
            {t('drive.yes')}
          </button>
          <button type="button" onClick={() => answer(false)} className="press h-10 rounded-full bg-card px-4 font-semibold">
            {t('drive.no')}
          </button>
        </div>
      )}
      {note && <p className="mb-2 text-center text-[14px] font-medium text-muted">{note}</p>}
      {!location && <p className="mb-2 text-center text-[14px] text-muted">{t('drive.needLocation')}</p>}
      <div data-sheet-drag data-sheet-fold className="flex touch-none items-center gap-3 pb-2">
        <div className="min-w-0 flex-1">
          <p className="tabular text-[24px] leading-tight font-bold">{formatClock(Date.now() + remainingSeconds * 1000)}</p>
          <p className="tabular truncate text-[15px] text-muted">
            {time(remainingSeconds)} · {distance(progress?.remaining ?? route.meters)}
          </p>
        </div>
        {limit > 0 && <LimitSign limit={limit} />}
        <span className={`tabular grid size-14 shrink-0 place-items-center rounded-full text-center leading-none ${speeding ? 'bg-rose-600 text-white' : 'bg-raised'}`}>
          <span>
            <span className="block text-[20px] font-bold">{Math.round(kmh)}</span>
            <span className="block text-[10.5px] font-semibold text-muted">{t('drive.speed')}</span>
          </span>
        </span>
      </div>
      <div className="mb-3 grid grid-cols-[1fr_auto_auto_auto] gap-2">
        <button type="button" onClick={stop} className="press flex h-12 items-center justify-center gap-2 rounded-full bg-rose-600 font-semibold text-white">
          <X className="size-5" />
          {t('drive.end')}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!reporting) setSnap('half');
            setReporting(!reporting);
          }}
          aria-expanded={reporting}
          aria-label={t('drive.report')}
          title={t('drive.report')}
          className={`press grid size-12 place-items-center rounded-full ${reporting ? 'bg-primary-soft text-primary' : 'bg-raised'}`}
        >
          <Flag className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setVoice(!voice)}
          aria-label={t(voice ? 'drive.voiceOn' : 'drive.voiceOff')}
          title={t(voice ? 'drive.voiceOn' : 'drive.voiceOff')}
          className="press grid size-12 place-items-center rounded-full bg-raised"
        >
          {voice ? <Volume2 className="size-5" /> : <VolumeX className="size-5 text-muted" />}
        </button>
        {follow ? (
          <button type="button" onClick={overview} aria-label={t('drive.overview')} title={t('drive.overview')} className="press grid size-12 place-items-center rounded-full bg-raised">
            <MapIcon className="size-5" />
          </button>
        ) : (
          <button type="button" onClick={() => setFollow(true)} aria-label={t('drive.resume')} title={t('drive.resume')} className="press grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
            <LocateFixed className="size-5" />
          </button>
        )}
      </div>
      {reporting && (
        <div className="mb-3 grid grid-cols-4 gap-2">
          {REPORT_KINDS.map((kind) => (
            <button key={kind} type="button" onClick={() => report(kind)} className="press flex flex-col items-center gap-1.5 rounded-2xl bg-raised px-1 py-2.5">
              <span className="grid size-10 place-items-center rounded-full text-white" style={{ background: REPORT_COLORS[kind] }}>
                <ReportGlyph kind={kind} />
              </span>
              <span className="text-[12.5px] leading-tight font-semibold">{t(`drive.reportKinds.${kind}`)}</span>
            </button>
          ))}
        </div>
      )}
      {ahead.length > 0 && (
        <>
          <h3 className="mb-2 px-1 text-[15px] font-semibold text-muted">{t('drive.ahead')}</h3>
          <div className="surface-card divide-y divide-hairline rounded-card">
            {ahead.slice(0, 4).map((event) => {
              const { icon: Icon, tone } = ROAD_EVENT_STYLE[event.kind];
              return (
                <div key={event.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full text-white ${tone}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{t(`road.kinds.${event.kind}`)}</span>
                    <span className="block truncate text-[13px] text-muted">{roadTitle(event)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
