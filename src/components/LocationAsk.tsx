import { LocateFixed } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { startLocating } from '@/map/location';
import { useSettings } from '@/state/settings';

export type LocationReason = 'drive' | 'start' | 'locate';

interface AskState {
  reason: LocationReason | null;
  answer: ((yes: boolean) => void) | null;
}

const useAsk = create<AskState>(() => ({ reason: null, answer: null }));

export function askForLocation(reason: LocationReason): Promise<boolean> {
  if (!useSettings.getState().noLocation) {
    startLocating(true);
    return Promise.resolve(true);
  }
  return new Promise((resolve) =>
    useAsk.setState({
      reason,
      answer: (yes) => {
        useAsk.setState({ reason: null, answer: null });
        if (yes) startLocating(true);
        resolve(yes);
      },
    }),
  );
}

export function LocationAsk() {
  const { t } = useTranslation();
  const { reason, answer } = useAsk();
  if (!reason || !answer) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-6" onClick={() => answer(false)}>
      <div role="alertdialog" aria-modal="true" className="surface-sheet w-full max-w-sm rounded-[28px] p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
          <LocateFixed className="size-6" />
        </span>
        <p className="text-[18px] leading-snug font-bold">{t('locationAsk.title')}</p>
        <p className="mt-1.5 text-[15px] text-muted">{t(`locationAsk.${reason}`)}</p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={() => answer(true)} className="press primary-fill h-12 rounded-full font-semibold">
            {t('locationAsk.yes')}
          </button>
          <button type="button" onClick={() => answer(false)} className="press h-12 rounded-full bg-raised font-semibold">
            {t('locationAsk.no')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
