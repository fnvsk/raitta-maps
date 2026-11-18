import { ArrowDownUp, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SchemeNetwork } from '@/core/scheme';
import { fold } from '@/core/search';

const SHOWN = 6;

export function StationSearch({
  network,
  from,
  to,
  onFrom,
  onTo,
}: {
  network: SchemeNetwork;
  from: string | null;
  to: string | null;
  onFrom: (id: string | null) => void;
  onTo: (id: string | null) => void;
}) {
  const { t } = useTranslation();
  const names = useMemo(() => new Map(network.stations.map((s) => [s.id, s.name])), [network]);
  return (
    <div className="surface-card relative rounded-[20px] p-1.5">
      <Field marker="bg-[#12A150]" placeholder={t('scheme.fromField')} value={from ? names.get(from)! : ''} network={network} onPick={onFrom} />
      <div className="mx-3 h-px bg-hairline" />
      <Field marker="bg-[#E11D48]" placeholder={t('scheme.toField')} value={to ? names.get(to)! : ''} network={network} onPick={onTo} />
      {from && to && (
        <button
          type="button"
          aria-label={t('plan.swap')}
          onClick={() => {
            onFrom(to);
            onTo(from);
          }}
          className="press absolute top-1/2 right-11 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-card shadow-sm ring-1 ring-hairline"
        >
          <ArrowDownUp className="size-4 text-muted" />
        </button>
      )}
    </div>
  );
}

function Field({ marker, placeholder, value, network, onPick }: { marker: string; placeholder: string; value: string; network: SchemeNetwork; onPick: (id: string | null) => void }) {
  const [query, setQuery] = useState<string | null>(null);
  const text = query ?? value;
  const found = useMemo(() => {
    if (query === null || !query.trim()) return [];
    const q = fold(query.trim());
    return network.stations
      .filter((s) => fold(s.name).includes(q))
      .sort((a, b) => Number(!fold(b.name).startsWith(q)) - Number(!fold(a.name).startsWith(q)) || a.name.localeCompare(b.name))
      .slice(0, SHOWN);
  }, [query, network]);
  return (
    <div className="relative">
      <label className="flex h-11 items-center gap-3 px-3">
        <span className={`size-3 shrink-0 rounded-full ${marker}`} />
        <input
          value={text}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={() => setTimeout(() => setQuery(null), 150)}
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:font-medium placeholder:text-muted"
        />
        {value && (
          <button type="button" aria-label="×" onClick={() => onPick(null)} className="press grid size-7 place-items-center rounded-full text-muted">
            <X className="size-4" />
          </button>
        )}
      </label>
      {found.length > 0 && (
        <div className="surface absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-[16px] py-1">
          {found.map((station) => (
            <button
              key={station.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(station.id);
                setQuery(null);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-raised"
            >
              <span className="flex shrink-0 gap-1">
                {station.lines.slice(0, 3).map((line) => (
                  <span key={line} className="grid h-5 min-w-7 place-items-center rounded-[6px] px-1 text-[11px] font-bold text-white" style={{ background: network.colors[line] }}>
                    {line}
                  </span>
                ))}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{station.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
