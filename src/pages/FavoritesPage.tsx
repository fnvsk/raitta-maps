import { ChevronRight, Heart, Star } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { Card, Divided, LineBadge, PageTitle, SectionTitle, useCountdown } from '@/components/ui';
import type { Stop } from '@/core/types';
import { useDepartures, useLineIndex, useNow, useRegionId, useStopIndex } from '@/data/hooks';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';

function FavoriteStop({ stop }: { stop: Stop }) {
  const { t } = useTranslation();
  const { departures, loading } = useDepartures(stop);
  const lines = useLineIndex();
  const now = useNow();
  const countdown = useCountdown();
  const next = departures.slice(0, 3);

  return (
    <Link to={`/stops/${stop.id}`} className="block px-3.5 py-3 active:bg-raised">
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold">{stop.name}</span>
        <ChevronRight className="size-5 shrink-0 text-(--muted-icon)" />
      </span>
      {!loading && !next.length && <span className="mt-1 block text-[13px] text-muted">{t('favorites.noUpcoming')}</span>}
      {next.length > 0 && (
        <span className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1">
          {next.map((d) => (
            <span key={`${d.line}-${d.scheduled}`} className="flex items-center gap-1.5">
              <LineBadge line={d.line} mode={lines.get(d.line)?.mode ?? 'bus'} size="sm" />
              <span className="tabular text-[13px] font-medium">{countdown(d.time, now)}</span>
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}

export function FavoritesPage() {
  const { t } = useTranslation();
  useSheetSnap('full');
  const setFocus = useUi((s) => s.setFocus);
  const region = useRegionId();
  const stopIds = useSettings((s) => s.favoriteStops[region]) ?? [];
  const lineIds = useSettings((s) => s.favoriteLines[region]) ?? [];
  const places = useSettings((s) => s.favoritePlaces);
  const stops = useStopIndex();
  const lines = useLineIndex();

  useEffect(() => setFocus({}), [setFocus]);

  const savedStops = stopIds.flatMap((id) => stops.get(id) ?? []);
  const savedLines = lineIds.flatMap((id) => lines.get(id) ?? []);
  const empty = !savedStops.length && !savedLines.length && !places.length;

  return (
    <>
      <div data-sheet-fold>
        <PageTitle>{t('favorites.title')}</PageTitle>
      </div>
      {empty && (
        <div className="px-6 pt-16 text-center">
          <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-raised">
            <Star className="size-7 text-(--muted-icon)" />
          </span>
          <p className="text-[17px] font-semibold">{t('favorites.empty')}</p>
          <p className="mt-1 text-muted">{t('favorites.emptyHint')}</p>
        </div>
      )}
      {places.length > 0 && (
        <>
          <SectionTitle>{t('favorites.places')}</SectionTitle>
          <Card>
            <Divided>
              {places.map((place) => (
                <Link key={place.path} to={place.path} className="flex items-center gap-3 px-3 py-3 active:bg-raised">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rose-500/12 text-rose-500">
                    <Heart className="size-4.5" fill="currentColor" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{place.name}</span>
                    {place.kind && <span className="block truncate text-[13px] text-muted">{place.kind}</span>}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-(--muted-icon)" />
                </Link>
              ))}
            </Divided>
          </Card>
        </>
      )}
      {savedStops.length > 0 && (
        <>
          <SectionTitle>{t('favorites.stops')}</SectionTitle>
          <Card>
            <Divided>
              {savedStops.map((stop) => (
                <FavoriteStop key={stop.id} stop={stop} />
              ))}
            </Divided>
          </Card>
        </>
      )}
      {savedLines.length > 0 && (
        <>
          <SectionTitle>{t('favorites.lines')}</SectionTitle>
          <Card>
            <Divided>
              {savedLines.map((line) => (
                <Link key={line.id} to={`/routes/${encodeURIComponent(line.id)}`} className="flex items-center gap-3 px-3 py-3 active:bg-raised">
                  <LineBadge line={line.id} mode={line.mode} />
                  <span className="min-w-0 flex-1 text-[14px] leading-snug">{line.name}</span>
                  <ChevronRight className="size-5 shrink-0 text-(--muted-icon)" />
                </Link>
              ))}
            </Divided>
          </Card>
        </>
      )}
    </>
  );
}
