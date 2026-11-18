import { Check, MapPinOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { BackButton } from '@/components/ui';
import { distanceM } from '@/core/geo';
import { emblemOf } from '@/core/emblems';
import { REGIONS, regionName } from '@/core/regions';
import { fold } from '@/core/search';
import { useRegionId, useRegionPhotos, useRegions } from '@/data/hooks';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';
import { FilterInput } from './StopsPage';

const REGION_ZOOM = 12.2;
const CARD_STAGGER_MS = 45;
const CHOOSE_MS = 260;

const FALLBACKS = ['#155eef', '#7c2bd9', '#12a150', '#ff5c35', '#0e7490', '#c026d3'];

const SERVED: Record<string, string[]> = {
  helsinki: ['Espoo', 'Esbo', 'Эспоо', 'Vantaa', 'Vanda', 'Вантаа', 'Kauniainen', 'Grankulla', 'Kerava', 'Kervo', 'Kirkkonummi', 'Kyrkslätt', 'Sipoo', 'Sibbo', 'Tuusula', 'Tusby', 'Siuntio'],
  tampere: ['Nokia', 'Pirkkala', 'Lempäälä', 'Kangasala', 'Ylöjärvi', 'Orivesi', 'Vesilahti', 'Pälkäne'],
  turku: ['Åbo', 'Raisio', 'Reso', 'Kaarina', 'S:t Karins', 'Naantali', 'Nådendal', 'Lieto', 'Rusko'],
  oulu: ['Uleåborg', 'Kempele', 'Kiiminki', 'Haukipudas', 'Liminka', 'Muhos'],
  jyvaskyla: ['Jyväskylä', 'Muurame', 'Laukaa'],
  kuopio: ['Siilinjärvi'],
  lahti: ['Hollola', 'Nastola', 'Orimattila'],
  pori: ['Björneborg', 'Ulvila'],
  joensuu: ['Kontiolahti', 'Liperi'],
  lappeenranta: ['Villmanstrand', 'Lappee'],
  hameenlinna: ['Tavastehus', 'Hattula', 'Janakkala'],
  vaasa: ['Vasa', 'Mustasaari', 'Korsholm'],
  rovaniemi: [],
  kotka: ['Hamina', 'Fredrikshamn'],
  kouvola: [],
  mikkeli: ['S:t Michel'],
  salo: [],
  kajaani: ['Kajana'],
  raasepori: ['Raseborg', 'Tammisaari', 'Ekenäs', 'Karjaa', 'Karis', 'Hanko', 'Hangö'],
};

export function RegionsPage() {
  const { t, i18n } = useTranslation();
  useSheetSnap('full');
  const navigate = useNavigate();
  const current = useRegionId();
  const setRegion = useSettings((s) => s.setRegion);
  const setFocus = useUi((s) => s.setFocus);
  const flyTo = useUi((s) => s.flyTo);
  const location = useUi((s) => s.location);
  const { data: regions } = useRegions();
  const { data: photos } = useRegionPhotos();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => setFocus({}), [setFocus]);

  const rows = useMemo(() => {
    const q = fold(query);
    const list = (regions ?? []).flatMap((info) => {
      const config = REGIONS.find((r) => r.id === info.id);
      if (!config) return [];
      const name = regionName(config, i18n.language);
      const matches = !q || [config.name, config.sv, config.ru, ...(SERVED[config.id] ?? [])].some((n) => fold(n).includes(q));
      return matches ? [{ info, name, distance: location ? distanceM(location, info.center) : 0 }] : [];
    });
    return location ? list.sort((a, b) => a.distance - b.distance) : list;
  }, [regions, query, location, i18n.language]);

  const choose = (id: string, center: { lat: number; lon: number }) => {
    setChosen(id);
    setTimeout(() => {
      setRegion(id);
      flyTo({ ...center, zoom: REGION_ZOOM });
      navigate('/');
    }, CHOOSE_MS);
  };

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-2 pb-3">
        <BackButton />
        <h1 className="text-[24px] font-bold tracking-tight">{t('regions.title')}</h1>
      </div>
      <FilterInput value={query} onChange={setQuery} placeholder={t('regions.search')} />
      {regions && !rows.length && (
        <div className="surface-card mt-1 flex flex-col items-center rounded-card px-6 py-8 text-center">
          <span className="mb-3 grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
            <MapPinOff className="size-6" />
          </span>
          <p className="text-[17px] font-semibold">{t('regions.empty')}</p>
          <p className="mt-1 max-w-72 text-[14px] text-muted">{t('regions.emptyHint', { count: regions.length })}</p>
          <button type="button" onClick={() => setQuery('')} className="press mt-4 h-11 rounded-full bg-primary-soft px-5 font-semibold text-primary">
            {t('regions.showAll')}
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {rows.map(({ info, name }, i) => {
          const photo = photos?.[info.id];
          const selected = info.id === current;
          return (
            <button
              key={info.id}
              type="button"
              onClick={() => choose(info.id, info.center)}
              style={{ animation: `card-in 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * CARD_STAGGER_MS}ms both`, background: FALLBACKS[i % FALLBACKS.length] }}
              className={`group relative aspect-[4/5] overflow-hidden rounded-[22px] text-left text-white transition-transform duration-300 active:scale-[0.97] ${
                chosen === info.id ? 'scale-[1.04]' : ''
              } ${selected ? 'ring-3 ring-primary ring-offset-2 ring-offset-bg' : ''}`}
            >
              {photo && (
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110"
                />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              {emblemOf(info.id) && (
                <span className="absolute top-2.5 left-2.5 grid size-12 place-items-center rounded-2xl bg-white/90 shadow-sm backdrop-blur-sm">
                  <img src={emblemOf(info.id)} alt="" loading="lazy" className="size-10 object-contain" />
                </span>
              )}
              {selected && (
                <span className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-white text-primary shadow">
                  <Check className="size-[18px]" />
                </span>
              )}
              <span className="absolute inset-x-3 bottom-3">
                <span className="block text-[19px] leading-tight font-bold drop-shadow">{name}</span>
                <span className="tabular mt-0.5 block text-[12px] text-white/85">
                  {t('regions.summary', { stops: info.stops.toLocaleString(i18n.language), lines: info.lines })}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {photos && (
        <details className="mt-4 px-1 text-[12px] text-muted">
          <summary className="cursor-pointer py-1 font-medium">{t('regions.photoCredits')}</summary>
          <ul className="mt-1 space-y-1">
            {rows.map(({ info, name }) => {
              const photo = photos[info.id];
              return photo ? (
                <li key={info.id}>
                  {name}:{' '}
                  <a href={photo.source} target="_blank" rel="noopener noreferrer" className="underline">
                    {photo.author}
                  </a>
                  , {photo.license}, Wikimedia Commons
                </li>
              ) : null;
            })}
          </ul>
        </details>
      )}
    </>
  );
}
