import { Bell, Check, ChevronRight, Flag, Footprints, LocateFixed, MapPin, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, LineBadge, ModeIcon, useDistanceLabel, ZoneChip } from '@/components/ui';
import { distanceM } from '@/core/geo';
import { PACE_FACTORS, walkSeconds, type Network } from '@/core/raptor';
import { formatClock } from '@/core/time';
import { currentStep, legStops, legVehicle, ridePosition, tripSteps, type TripStep } from '@/core/trip';
import type { Stop } from '@/core/types';
import { journeyZones } from '@/core/zones';
import { useLineIndex, useNow, useVehicles } from '@/data/hooks';
import { startLocating } from '@/map/location';
import { useSettings } from '@/state/settings';
import { useTrip } from '@/state/trip';
import { useUi } from '@/state/ui';
import { alertsSetFor, allowTripAlerts, buzz, scheduleTripAlerts } from '@/trip/alerts';

const TICK_MS = 5_000;

const SPARE_S = 60;

const GO_EARLY_S = 60;

const minutesUntil = (seconds: number) => Math.max(0, Math.ceil(seconds / 60));

export function TripPanel({ network, stops }: { network: Network; stops: Stop[] }) {
  const { t } = useTranslation();
  const trip = useTrip((s) => s.trip)!;
  const step = useTrip((s) => s.step);
  const passed = useTrip((s) => s.passed);
  const { setStep, setPassed, stop: endTrip } = useTrip.getState();
  const location = useUi((s) => s.location);
  const follow = useUi((s) => s.follow);
  const setFollow = useUi((s) => s.setFollow);
  const lines = useLineIndex();
  const distanceLabel = useDistanceLabel();
  const pace = PACE_FACTORS[useSettings((s) => s.walkingPace)];
  const { data: vehicles } = useVehicles();
  const nowMs = useNow(TICK_MS);

  const { journey, dayStart, destination, destinationName } = trip;
  const now = (nowMs - dayStart) / 1000;
  const clock = (seconds: number) => formatClock(dayStart + seconds * 1000);
  const steps = useMemo(() => tripSteps(journey, stops, destination), [journey, stops, destination]);
  const legLists = useMemo(() => journey.legs.map((leg) => legStops(network, leg)), [journey, network]);

  const current = steps[step];
  const legIndex = current.kind === 'walk' || current.kind === 'wait' || current.kind === 'ride' ? current.leg : null;
  const leg = legIndex === null ? null : journey.legs[legIndex];
  const vehicle = leg ? legVehicle(vehicles, leg, stops[leg.from], location, current.kind === 'ride') : undefined;

  const delays = useRef(journey.legs.map(() => 0));
  if (legIndex !== null && vehicle?.delaySec != null) delays.current[legIndex] = Math.max(0, vehicle.delaySec);
  const delay = legIndex === null ? 0 : delays.current[legIndex];

  useEffect(() => {
    const next = currentStep(steps, step, { journey, stops, now, location, delays: delays.current });
    if (next !== step) {
      setStep(next);
      if (steps[next].kind !== 'ride') buzz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, location, step]);

  const list = legIndex === null ? [] : legLists[legIndex];
  const position = current.kind === 'ride' ? ridePosition(list, stops, location, now, delay, passed[legIndex!] ?? 0) : 0;
  const stopsLeft = Math.max(0, list.length - 1 - position);
  useEffect(() => {
    if (current.kind === 'ride' && position > (passed[current.leg] ?? 0)) setPassed(current.leg, position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, step]);

  const warned = useRef(new Set<number>());
  useEffect(() => {
    if (current.kind === 'ride' && stopsLeft <= 1 && !warned.current.has(current.leg)) {
      warned.current.add(current.leg);
      buzz();
    }
  }, [current, stopsLeft]);

  useEffect(() => {
    startLocating();
    setFollow(true);
    useUi.getState().setHeadingUp(true);
    if (!alertsSetFor(trip)) void allowTripAlerts().then(() =>
      scheduleTripAlerts(
        trip,
        journey.legs.flatMap((leg, i) => {
          const list = legLists[i];
          const walk = i === 0 ? journey.walkStartS : leg.walkBefore;
          const line = leg.line;
          const before = list[Math.max(0, list.length - 2)];
          return [
            {
              at: dayStart + (leg.departure - walk - GO_EARLY_S) * 1000,
              title: t('trip.alertGoTitle'),
              body: t('trip.alertGoBody', { line, stop: stops[leg.from].name, time: clock(leg.departure) }),
            },
            {
              at: dayStart + before.time * 1000,
              title: t('trip.alertOffTitle'),
              body: t('trip.alertOffBody', { stop: stops[leg.to].name }),
            },
          ];
        }),
      ),
    );
    let lock: WakeLockSentinel | undefined;
    const keepAwake = () => {
      if (document.visibilityState === 'visible') void navigator.wakeLock?.request('screen').then((sentinel) => (lock = sentinel)).catch(() => {});
    };
    keepAwake();
    document.addEventListener('visibilitychange', keepAwake);
    return () => {
      setFollow(false);
      useUi.getState().setHeadingUp(false);
      document.removeEventListener('visibilitychange', keepAwake);
      void lock?.release().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey]);

  const modeOf = (line: string) => lines.get(line)?.mode ?? 'bus';
  const zones = useMemo(() => journeyZones(network, journey), [network, journey]);
  const vehicleName = (line: string) => t(`trip.mode.${modeOf(line)}`, { line });

  return (
    <>
      {renderHero()}
      <div className="mb-2.5 flex gap-2">
        <button type="button" onClick={() => setStep(Math.min(step + 1, steps.length - 1))} disabled={current.kind === 'arrived'} className="press flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-raised font-semibold disabled:opacity-40">
          {t('trip.next')}
          <ChevronRight className="size-4" />
        </button>
        {location && !follow && (
          <button type="button" onClick={() => setFollow(true)} aria-label={t('trip.follow')} className="press grid size-11 place-items-center rounded-full bg-raised text-primary">
            <LocateFixed className="size-5" />
          </button>
        )}
        <button type="button" onClick={endTrip} className="press flex h-11 items-center gap-1.5 rounded-full bg-raised px-4 font-semibold text-rose-600">
          <X className="size-4" />
          {current.kind === 'arrived' ? t('trip.finish') : t('trip.end')}
        </button>
      </div>
      {zones && (
        <p className="mb-2.5 flex items-center gap-2 px-1 text-[14px] text-muted">
          {t('trip.ticketFor')} <ZoneChip zones={zones} />
        </p>
      )}
      {renderTimeline()}
    </>
  );

  function renderHero() {
    if (current.kind === 'arrived') {
      return (
        <Card className="mb-2.5 p-5 text-center">
          <span className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-emerald-600 text-white">
            <Flag className="size-7" />
          </span>
          <p className="text-[22px] font-bold">{t('trip.arrived')}</p>
          <p className="mt-1 text-muted">{destinationName}</p>
        </Card>
      );
    }

    if (current.kind === 'walk' || current.kind === 'walkEnd') {
      const meters = location ? distanceM(location, current.target) : null;
      const walkS = meters === null ? null : walkSeconds(meters, pace);
      const walkLeg = current.kind === 'walk' ? current.leg : null;
      const toEnd = walkLeg === null;
      const legHere = walkLeg === null ? null : journey.legs[walkLeg];
      const departs = legHere ? legHere.departure + delays.current[walkLeg!] : null;
      const spare = departs === null || walkS === null ? null : departs - now - walkS;
      const status = spare === null ? null : spare >= SPARE_S ? 'onTime' : spare >= -30 ? 'hurry' : 'missed';
      const title = toEnd
        ? t('trip.walkToEnd', { place: destinationName })
        : walkLeg! > 0
          ? t('trip.change', { stop: stops[legHere!.from].name })
          : t('trip.walkTo', { stop: stops[legHere!.from].name });
      return (
        <Card className="mb-2.5 overflow-hidden">
          <div className="primary-fill flex items-center gap-3 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20">
              {toEnd ? <MapPin className="size-6" /> : <Footprints className="size-6" />}
            </span>
            <p className="min-w-0 flex-1 text-[19px] leading-tight font-bold">{title}</p>
          </div>
          <div className="space-y-2 p-4">
            {meters !== null && walkS !== null && (
              <p className="tabular text-[15px]">{t('trip.walkMeta', { distance: distanceLabel(meters), count: minutesUntil(walkS) })}</p>
            )}
            {legHere && departs !== null && (
              <p className="flex flex-wrap items-center gap-2">
                <LineBadge line={legHere.line} mode={modeOf(legHere.line)} />
                <span className="tabular font-semibold">
                  {departs - now > 30 ? t('trip.leavesIn', { count: minutesUntil(departs - now), time: clock(departs) }) : t('trip.leavingNow')}
                </span>
              </p>
            )}
            {status && (
              <p className={`text-[15px] font-semibold ${status === 'onTime' ? 'text-emerald-600' : status === 'hurry' ? 'text-amber-600' : 'text-rose-600'}`}>
                {t(`trip.${status}`)}
              </p>
            )}
            {status === 'missed' && (
              <button type="button" onClick={endTrip} className="press w-full rounded-full bg-raised py-2.5 font-semibold text-primary">
                {t('trip.replan')}
              </button>
            )}
          </div>
        </Card>
      );
    }

    const here = journey.legs[current.leg];
    const mode = modeOf(here.line);

    if (current.kind === 'wait') {
      const departs = here.departure + delay;
      const away = vehicle ? distanceM(vehicle, stops[here.from]) : null;
      return (
        <Card className="mb-2.5 overflow-hidden">
          <div className="primary-fill flex items-center gap-3 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20">
              <ModeIcon mode={mode} className="size-6" />
            </span>
            <p className="min-w-0 flex-1 text-[19px] leading-tight font-bold">{t('trip.waitFor', { vehicle: vehicleName(here.line), headsign: here.headsign })}</p>
          </div>
          <div className="flex items-end justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-[13px] text-muted">{t('trip.atStop', { stop: stops[here.from].name })}</p>
              {away !== null && <p className="mt-1 text-[15px]">{t('trip.vehicleAway', { distance: distanceLabel(away) })}</p>}
              <p className={`mt-1 text-[14px] font-semibold ${delay > 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {delay > 60 ? t('trip.late', { count: Math.round(delay / 60) }) : vehicle ? t('trip.onSchedule') : ''}
              </p>
            </div>
            <p className="tabular shrink-0 text-right">
              <span className="block text-[40px] leading-none font-bold">{departs - now > 30 ? minutesUntil(departs - now) : t('trip.now')}</span>
              {departs - now > 30 && <span className="text-[13px] text-muted">{t('trip.minutes')}</span>}
            </p>
          </div>
        </Card>
      );
    }

    const next = list[Math.min(position + 1, list.length - 1)];
    const alightTime = here.arrival + delay;
    const urgent = stopsLeft <= 1;
    return (
      <Card className="mb-2.5 overflow-hidden">
        <div className={`flex items-center gap-3 p-4 ${urgent ? 'bg-amber-400 text-[#0e1526]' : 'primary-fill'}`}>
          <span className={`grid size-11 shrink-0 place-items-center rounded-full ${urgent ? 'bg-black/10' : 'bg-white/20'}`}>
            {urgent ? <Bell className="size-6" /> : <ModeIcon mode={mode} className="size-6" />}
          </span>
          <p className="min-w-0 flex-1 text-[19px] leading-tight font-bold">
            {stopsLeft === 0 ? t('trip.getOffNow') : stopsLeft === 1 ? t('trip.nextIsYours') : t('trip.stopsLeft', { count: stopsLeft })}
          </p>
        </div>
        <div className="space-y-1.5 p-4">
          <p className="flex flex-wrap items-center gap-2">
            <LineBadge line={here.line} mode={mode} />
            <span className="font-semibold">{here.headsign}</span>
          </p>
          {stopsLeft > 0 && <p className="text-[15px]">{t('trip.nextStop', { stop: stops[next.stop].name })}</p>}
          <p className="tabular text-[15px] text-muted">{t('trip.getOffAt', { stop: stops[here.to].name, time: clock(alightTime) })}</p>
          <div className="flex gap-1 pt-2" aria-hidden="true">
            {list.slice(1).map((item, i) => (
              <span key={`${item.stop}-${i}`} className={`h-1.5 flex-1 rounded-full ${i < position ? 'bg-primary' : i === list.length - 2 ? 'bg-amber-400' : 'bg-raised'}`} />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  function renderTimeline() {
    const label = (item: TripStep) => {
      switch (item.kind) {
        case 'walk':
          return t('trip.walkTo', { stop: stops[journey.legs[item.leg].from].name });
        case 'wait':
          return t('trip.waitShort', { stop: stops[journey.legs[item.leg].from].name, time: clock(journey.legs[item.leg].departure) });
        case 'ride':
          return t('trip.rideShort', { stop: stops[journey.legs[item.leg].to].name, time: clock(journey.legs[item.leg].arrival) });
        case 'walkEnd':
          return t('trip.walkToEnd', { place: destinationName });
        case 'arrived':
          return t('trip.arriveAt', { time: clock(journey.arriveAt) });
      }
    };
    return (
      <Card className="p-2">
        <ol>
          {steps.map((item, i) => {
            const state = i < step ? 'done' : i === step ? 'now' : 'later';
            return (
              <li key={i} className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${state === 'now' ? 'bg-raised' : ''}`}>
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold ${
                    state === 'done' ? 'bg-emerald-600 text-white' : state === 'now' ? 'primary-fill' : 'bg-raised text-muted'
                  }`}
                >
                  {state === 'done' ? <Check className="size-4" /> : 'leg' in item && item.kind === 'ride' ? <ModeIcon mode={modeOf(journey.legs[item.leg].line)} className="size-4" /> : i + 1}
                </span>
                <span className={`min-w-0 flex-1 text-[14px] ${state === 'done' ? 'text-muted line-through' : state === 'now' ? 'font-semibold' : ''}`}>{label(item)}</span>
              </li>
            );
          })}
        </ol>
      </Card>
    );
  }
}
