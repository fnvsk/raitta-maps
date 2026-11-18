import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSheetSnap } from '@/components/Panel';
import { Card, Divided, Message, PageTitle, RowSkeleton, SectionTitle, StopRow, useDistanceLabel } from '@/components/ui';
import { distanceM, nearest } from '@/core/geo';
import { searchStops } from '@/core/search';
import { useStops } from '@/data/hooks';
import { useReferencePoint } from '@/map/location';
import { useUi } from '@/state/ui';

export function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label data-sheet-fold className="surface-card mb-3 flex h-11 items-center gap-2.5 rounded-full px-4">
      <Search className="size-[18px] shrink-0 text-(--muted-icon)" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
      />
    </label>
  );
}

export function StopsPage() {
  const { t } = useTranslation();
  const snap = useUi((s) => s.snap);
  useSheetSnap('full');
  const [query, setQuery] = useState('');
  const setFocus = useUi((s) => s.setFocus);
  const { data: stops } = useStops();
  const { point, isRider } = useReferencePoint();
  const distanceLabel = useDistanceLabel();

  useEffect(() => setFocus({}), [setFocus]);

  const searching = query.trim().length > 0;
  const results = useMemo(() => {
    if (!stops) return [];
    if (searching) return searchStops(stops, query, 40).map((item) => ({ item, distance: distanceM(point, item) }));
    return nearest(stops, point, 20);
  }, [stops, query, searching, point]);

  return (
    <>
      {snap !== 'mini' && <PageTitle>{t('tabs.stops')}</PageTitle>}
      <FilterInput value={query} onChange={setQuery} placeholder={t('search.stops')} />
      {!searching && <SectionTitle>{t(isRider ? 'map.nearby' : 'map.nearCenter')}</SectionTitle>}
      <Card>
        {!stops && <RowSkeleton rows={6} />}
        {stops && !results.length && <Message>{t('search.noResults', { query })}</Message>}
        <Divided>
          {results.map(({ item, distance }) => (
            <StopRow key={item.id} stop={item} subtitle={`${item.code} · ${distanceLabel(distance)}`} />
          ))}
        </Divided>
      </Card>
    </>
  );
}
