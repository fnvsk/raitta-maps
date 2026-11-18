import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { Card, Divided, LineBadge, Message, PageTitle, RowSkeleton, Segmented } from '@/components/ui';
import { searchLines } from '@/core/search';
import type { Mode } from '@/core/types';
import { useLines } from '@/data/hooks';
import { useDrive } from '@/state/drive';
import { useUi } from '@/state/ui';
import { PlanPanel } from './PlanPanel';
import { FilterInput } from './StopsPage';
import { useSettings } from '@/state/settings';
import { REGIONS } from '@/core/regions';

type ModeFilter = 'all' | Mode;

function LineList() {
  const { t } = useTranslation();
  const { data: lines } = useLines();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<ModeFilter>('all');

  const visible = useMemo(() => {
    const ofMode = (lines ?? []).filter((l) => mode === 'all' || l.mode === mode);
    return query.trim() ? searchLines(ofMode, query, 200) : ofMode;
  }, [lines, query, mode]);

  const modes = [...new Set((lines ?? []).map((l) => l.mode))];
  const filters: { value: ModeFilter; label: string }[] = [
    { value: 'all', label: t('routes.all') },
    ...modes.map((value) => ({ value, label: t(`modes.${value}`) })),
  ];

  return (
    <>
      <FilterInput value={query} onChange={setQuery} placeholder={t('routes.filter')} />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={mode === f.value}
            onClick={() => setMode(f.value)}
            className={`press rounded-full px-3.5 py-1.5 text-[14px] font-semibold ${
              mode === f.value ? 'primary-fill' : 'bg-raised text-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <Card>
        {!lines && <RowSkeleton rows={8} />}
        {lines && !visible.length && <Message>{t('routes.empty')}</Message>}
        <Divided>
          {visible.map((line) => (
            <Link key={line.id} to={`/routes/${encodeURIComponent(line.id)}`} className="flex items-center gap-3 px-3 py-3 active:bg-raised">
              <span className="w-12 shrink-0">
                <LineBadge line={line.id} mode={line.mode} />
              </span>
              <span className="min-w-0 flex-1 text-[14px] leading-snug">{line.name}</span>
              <ChevronRight className="size-5 shrink-0 text-(--muted-icon)" />
            </Link>
          ))}
        </Divided>
      </Card>
    </>
  );
}

export function RoutesPage() {
  const { t } = useTranslation();
  useSheetSnap('full');
  const [params, setParams] = useSearchParams();

  const linkRegion = params.get('region');
  const setRegion = useSettings((s) => s.setRegion);
  const currentRegion = useSettings((s) => s.region);
  useEffect(() => {
    if (linkRegion && linkRegion !== currentRegion && REGIONS.some((r) => r.id === linkRegion)) setRegion(linkRegion);
  }, [linkRegion, currentRegion, setRegion]);
  const setFocus = useUi((s) => s.setFocus);

  const folded = useUi((s) => s.snap === 'mini');
  const driving = useDrive((s) => s.drive !== null);
  const collapsed = folded || driving;
  const view = params.get('view') === 'plan' ? 'plan' : 'lines';
  const toName = params.get('toName');
  const initialPoint = toName
    ? { name: toName, point: { lat: Number(params.get('toLat')), lon: Number(params.get('toLon')) } }
    : undefined;

  const fromName = params.get('fromName');
  const initialFrom = fromName ? { name: fromName, point: { lat: Number(params.get('fromLat')), lon: Number(params.get('fromLon')) } } : undefined;

  useEffect(() => setFocus({}), [setFocus]);

  return (
    <>
      {!collapsed && (
        <>
          <PageTitle>{t('routes.title')}</PageTitle>
          <div className="mb-3">
            <Segmented
              value={view}
              onChange={(next) => setParams(next === 'plan' ? { view: 'plan' } : {}, { replace: true })}
              options={[
                { value: 'lines', label: t('routes.lines') },
                { value: 'plan', label: t('routes.plan') },
              ]}
            />
          </div>
        </>
      )}
      {view === 'plan' ? <PlanPanel initialTo={params.get('to') ?? undefined} initialPoint={initialPoint} initialFrom={initialFrom} startTyping={params.has('start')} ride={params.get('ride') ?? undefined} /> : <LineList />}
    </>
  );
}
