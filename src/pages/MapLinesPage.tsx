import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSheetSnap } from '@/components/Panel';
import { BackButton, Card, MODE_BADGE, ModeIcon, RowSkeleton } from '@/components/ui';
import type { Line, Mode } from '@/core/types';
import { useLines, useRegion } from '@/data/hooks';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';

const MODE_ORDER: Mode[] = ['tram', 'metro', 'train', 'bus', 'ferry'];

export function MapLinesPage() {
  const { t } = useTranslation();
  useSheetSnap('full');
  const region = useRegion();
  const setFocus = useUi((s) => s.setFocus);
  const { data: lines } = useLines();
  const hidden = useSettings((s) => s.hiddenLines[region.id]) ?? [];
  const setHiddenLines = useSettings((s) => s.setHiddenLines);

  useEffect(() => setFocus({}), [setFocus]);

  const groups = useMemo(() => {
    const byMode = new Map<Mode, Line[]>();
    for (const line of lines ?? []) byMode.set(line.mode, [...(byMode.get(line.mode) ?? []), line]);
    return MODE_ORDER.filter((mode) => byMode.has(mode)).map((mode) => ({ mode, lines: byMode.get(mode)! }));
  }, [lines]);

  const save = (next: string[]) => setHiddenLines(region.id, [...new Set(next)]);
  const toggle = (id: string) => save(hidden.includes(id) ? hidden.filter((line) => line !== id) : [...hidden, id]);

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-2 pb-2">
        <BackButton />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold tracking-tight">{t('mapLines.title')}</h1>
          <p className="truncate text-[14px] text-muted">{region.name}</p>
        </div>
      </div>
      <p className="mb-3 px-1 text-[14px] text-muted">{t('mapLines.hint')}</p>
      <button
        type="button"
        disabled={!hidden.length}
        onClick={() => save([])}
        className="primary-fill press mb-4 h-11 w-full rounded-full font-semibold disabled:opacity-50"
      >
        {t('mapLines.showAll')}
      </button>
      {!lines && (
        <Card>
          <RowSkeleton rows={4} />
        </Card>
      )}
      {groups.map(({ mode, lines: ofMode }) => {
        const shownCount = ofMode.filter((line) => !hidden.includes(line.id)).length;
        const allShown = shownCount === ofMode.length;
        const ids = ofMode.map((line) => line.id);
        return (
          <section key={mode} className="mb-5">
            <div className="mb-2 flex items-center gap-2.5 px-1">
              <span className={`grid size-8 place-items-center rounded-[10px] text-white ${MODE_BADGE[mode]}`}>
                <ModeIcon mode={mode} className="size-[18px]" />
              </span>
              <h2 className="min-w-0 flex-1 text-[17px] font-semibold">
                {t(`modes.${mode}`)} <span className="tabular text-[14px] font-normal text-muted">{shownCount}/{ofMode.length}</span>
              </h2>
              <button
                type="button"
                onClick={() => save(allShown ? [...hidden, ...ids] : hidden.filter((id) => !ids.includes(id)))}
                className="py-1 text-[14px] font-semibold text-primary"
              >
                {t(allShown ? 'mapLines.hideAll' : 'mapLines.showMode')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ofMode.map((line) => {
                const shown = !hidden.includes(line.id);
                return (
                  <button
                    key={line.id}
                    type="button"
                    aria-pressed={shown}
                    title={line.name}
                    onClick={() => toggle(line.id)}
                    className={`tabular press h-9 min-w-11 rounded-[11px] px-2.5 text-[14px] font-semibold transition-colors ${
                      shown ? `${MODE_BADGE[mode]} text-white` : 'bg-raised text-muted line-through'
                    }`}
                  >
                    {line.id}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
