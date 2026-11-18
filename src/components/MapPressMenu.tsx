import { Flag, MapPin, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { nameOfPoint } from '@/core/geocode';
import { useUi } from '@/state/ui';

const MENU_WIDTH = 236;
const EDGE = 12;

export function MapPressMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const press = useUi((s) => s.mapPress);
  const setPress = useUi((s) => s.setMapPress);
  const setRouteEnd = useUi((s) => s.setRouteEnd);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setName(null);
    if (!press) return;
    const controller = new AbortController();
    void nameOfPoint(press, controller.signal)
      .then(setName)
      .catch(() => {});
    return () => controller.abort();
  }, [press]);

  if (!press) return null;
  const place = { name: name ?? t('plan.mapPoint'), point: { lat: press.lat, lon: press.lon } };
  const choose = (role: 'from' | 'to') => {
    setRouteEnd({ role, ...place });
    setPress(null);
    if (!(pathname === '/routes' && search.includes('view=plan'))) navigate('/routes?view=plan');
  };
  const left = Math.min(Math.max(EDGE, press.x - MENU_WIDTH / 2), window.innerWidth - MENU_WIDTH - EDGE);
  const below = press.y < 200;

  return createPortal(
    <div className="fixed inset-0 z-[70]" onPointerDown={() => setPress(null)}>
      <div
        role="dialog"
        className="surface-sheet absolute rounded-[20px] p-2 shadow-xl"
        style={{ left, width: MENU_WIDTH, top: below ? press.y + 18 : undefined, bottom: below ? undefined : window.innerHeight - press.y + 18 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 px-2 pt-1 pb-2">
          <span className="min-w-0 flex-1 text-[14px] leading-snug font-semibold">{name ?? t('common.loading')}</span>
          <button type="button" aria-label={t('common.close')} onClick={() => setPress(null)} className="grid size-6 shrink-0 place-items-center text-(--muted-icon)">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => choose('from')} className="press flex h-11 items-center justify-center gap-1.5 rounded-[14px] bg-raised text-[14px] font-semibold">
            <MapPin className="size-4 text-primary" />
            {t('plan.fromHere')}
          </button>
          <button type="button" onClick={() => choose('to')} className="press primary-fill flex h-11 items-center justify-center gap-1.5 rounded-[14px] text-[14px] font-semibold">
            <Flag className="size-4" />
            {t('plan.toHere')}
          </button>
        </div>
      </div>
      <span className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-primary shadow" style={{ left: press.x, top: press.y }} />
    </div>,
    document.body,
  );
}
