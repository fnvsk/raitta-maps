import {
  BedDouble,
  Building2,
  Check,
  Clock,
  Compass,
  Copy,
  Cross,
  Globe,
  GraduationCap,
  Heart,
  Landmark as LandmarkIcon,
  MapPin,
  Phone,
  ShoppingBag,
  ShoppingBasket,
  Trees,
  UtensilsCrossed,
  Briefcase,
  Car,
  Hammer,
  PawPrint,
  Scissors,
  Ticket,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { BackButton, Card, Divided, Message, RowSkeleton } from '@/components/ui';
import { commonsPhoto, inLanguage, sheetPhotoWidth } from '@/core/landmarks';
import { clockOf, openNow, parseOpeningHours, weekRows } from '@/core/openingHours';
import { useLandmarks, usePlaceExtra, usePlaceTags, useWikiSummary } from '@/data/hooks';
import { POI_CATEGORIES, poiGlyphOf, type PoiCategory } from '@/map/style';
import { POI_GLYPH_PATHS, type PoiGlyph } from '@/map/poiGlyphs';
import { placeKey, useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';

const PLACE_ZOOM = 16.2;
const SIGHT_COLOR = '#B45309';
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const CATEGORY_ICONS: Record<PoiCategory, typeof Heart> = {
  education: GraduationCap,
  grocery: ShoppingBasket,
  food: UtensilsCrossed,
  shop: ShoppingBag,
  health: Cross,
  culture: LandmarkIcon,
  lodging: BedDouble,
  nature: Trees,
  service: Building2,
  beauty: Scissors,
  pets: PawPrint,
  car: Car,
  fun: Ticket,
  office: Briefcase,
  craft: Hammer,
};

const categoryOf = (cls: string) => (Object.entries(POI_CATEGORIES).find(([, { classes }]) => cls in classes)?.[0] as PoiCategory | undefined);

function GlyphIcon({ glyph, className }: { glyph: PoiGlyph; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={POI_GLYPH_PATHS[glyph]} />
    </svg>
  );
}

function InfoRow({ icon, children, action }: { icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">
      <span className="shrink-0 text-(--muted-icon)">{icon}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {action}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={copied ? t('spot.copied') : t('spot.copy')}
      onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true))}
      className="press grid size-9 shrink-0 place-items-center rounded-full bg-raised text-primary"
    >
      {copied ? <Check className="size-4.5" /> : <Copy className="size-4.5" />}
    </button>
  );
}

function Hours({ text }: { text: string }) {
  const { t } = useTranslation();
  const rules = parseOpeningHours(text);
  const now = new Date();
  if (!rules) {
    return (
      <InfoRow icon={<Clock className="size-5" />}>
        <span className="text-[14px] text-muted">{t('spot.hours')}</span>
        <span className="block">{text}</span>
      </InfoRow>
    );
  }
  const state = openNow(rules, now);
  const today = (now.getDay() + 6) % 7;
  const allDay = (spans: [number, number][]) => spans.length === 1 && spans[0][0] === 0 && spans[0][1] >= 24 * 60;
  const dayName = (day: number) => t(`charging.days.${DAY_KEYS[day]}`);
  const status = state.open
    ? state.until === undefined || allDay(rules.find((rule) => rule.days.includes(today))?.spans ?? [])
      ? t('spot.openAllDay')
      : t('spot.openUntil', { time: clockOf(state.until) })
    : state.from !== undefined
      ? t('spot.opensAt', { time: clockOf(state.from) })
      : t('spot.closedNow');
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Clock className="size-5 shrink-0 text-(--muted-icon)" />
        <span className={`font-semibold ${state.open ? 'text-success' : 'text-rose-600 dark:text-rose-400'}`}>{status}</span>
      </div>
      <dl className="mt-2 ml-8 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
        {weekRows(rules).map((row) => {
          const isToday = today >= row.from && today <= row.to;
          const days = row.from === row.to ? dayName(row.from) : `${dayName(row.from)}${row.to - row.from > 1 ? '–' : ', '}${dayName(row.to)}`;
          const hours = !row.spans.length
            ? t('spot.closedDay')
            : allDay(row.spans)
              ? t('spot.openAllDay')
              : row.spans.map(([from, to]) => `${clockOf(from)}–${to === 24 * 60 ? '24:00' : clockOf(to)}`).join(', ');
          return (
            <div key={row.from} className={`contents ${isToday ? 'font-semibold' : 'text-muted'}`}>
              <dt className="first-letter:uppercase">{days}</dt>
              <dd className="tabular-nums">{hours}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function AboutText({ text, wikiUrl, clamp }: { text: string; wikiUrl?: string; clamp: string }) {
  const { t } = useTranslation();
  return (
    <>
      <p className={`${clamp} text-[15px] leading-relaxed`}>{text}</p>
      {wikiUrl ? (
        <a href={wikiUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[14px] font-semibold text-primary">
          {t('spot.readMore')}
        </a>
      ) : (
        <p className="mt-2 text-[13px] text-muted">{t('spot.fromSite')}</p>
      )}
    </>
  );
}

function Photo({ src, alt, about, wikiUrl }: { src: string; alt: string; about?: string; wikiUrl?: string }) {
  const [ratio, setRatio] = useState<number | null>(null);
  const tall = ratio !== null && ratio < 1.05;
  const image = (
    <img
      src={src}
      alt={alt}
      decoding="async"
      fetchPriority="high"
      onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
      className={tall ? 'h-full w-full rounded-[14px] object-cover' : 'w-full object-cover'}
      style={tall ? undefined : { aspectRatio: ratio ? String(Math.max(ratio, 1.3)) : '16 / 10', maxHeight: 280 }}
    />
  );
  if (tall) {
    return (
      <Card className="mb-3 flex gap-3 p-2">
        <div className="w-[42%] shrink-0" style={{ aspectRatio: String(Math.max(ratio!, 0.62)) }}>
          {image}
        </div>
        {about && (
          <div className="min-w-0 flex-1 py-1.5 pr-1.5">
            <AboutText text={about} wikiUrl={wikiUrl} clamp="line-clamp-[9]" />
          </div>
        )}
      </Card>
    );
  }
  return (
    <Card className="mb-3 overflow-hidden">
      {image}
      {about && (
        <div className="px-4 py-3">
          <AboutText text={about} wikiUrl={wikiUrl} clamp="line-clamp-6" />
        </div>
      )}
    </Card>
  );
}

export function PlacePage() {
  const { t, i18n } = useTranslation();
  useSheetSnap('half');
  const { source = '', type = '', id = '' } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const setFocus = useUi((s) => s.setFocus);
  const flyTo = useUi((s) => s.flyTo);
  const { data: landmarks } = useLandmarks();
  const landmark = source === 'wd' ? Object.values(landmarks ?? {}).flat().find((item) => item.id === id) : undefined;
  const osm = source === 'osm' ? `${type}(${id})` : null;
  const { data: tags, isLoading, isError } = usePlaceTags(osm);

  const lat = landmark?.lat ?? Number(params.get('lat'));
  const lon = landmark?.lon ?? Number(params.get('lon'));
  const name = (landmark ? inLanguage(landmark.name, i18n.language) : (tags?.[`name:${i18n.language}`] ?? tags?.name ?? params.get('name') ?? '')).split(';')[0].trim();
  const category = categoryOf(params.get('cls') ?? '');

  const glyph = poiGlyphOf(params.get('cls') ?? '', params.get('sub') ?? '');

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setFocus({ place: { lat, lon } });
    flyTo({ lat, lon, zoom: PLACE_ZOOM });
    return () => setFocus({});
  }, [lat, lon, setFocus, flyTo]);

  const website = tags?.website ?? tags?.['contact:website'];
  const phone = tags?.phone ?? tags?.['contact:phone'];

  const address = tags ? [[tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '), [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
  const wiki = useWikiSummary({ wiki: landmark?.wiki, wikipedia: tags?.wikipedia, wikidata: landmark ? landmark.id : tags?.wikidata }, i18n.language);

  const extra = usePlaceExtra(website);
  const ownHours = extra.data?.hours && parseOpeningHours(extra.data.hours) ? extra.data.hours : undefined;
  const hours = ownHours ?? tags?.opening_hours;

  const photoFile = landmark?.photo ?? (tags?.wikimedia_commons?.startsWith('File:') ? tags.wikimedia_commons.slice(5) : undefined);
  const photo = photoFile ? commonsPhoto(photoFile, sheetPhotoWidth(), landmark?.thumb) : tags?.image?.startsWith('https://') ? tags.image : extra.data?.image;
  const about = wiki.data?.extract ?? (landmark ? undefined : extra.data?.description);
  const plan = new URLSearchParams({ view: 'plan', toLat: String(lat), toLon: String(lon), toName: name || t('plan.mapPoint') });
  const kind = landmark ? t('spot.landmark') : category ? t(`spot.category.${category}`) : '';

  const subtitle = landmark?.about[i18n.language] ?? '';
  const Icon = landmark ? LandmarkIcon : category ? CATEGORY_ICONS[category] : MapPin;
  const tint = landmark ? SIGHT_COLOR : category ? POI_CATEGORIES[category].color : '#475569';

  const path = location.pathname + location.search;
  const favorite = useSettings((s) => s.favoritePlaces.some((place) => placeKey(place.path) === placeKey(path)));
  const toggleFavorite = useSettings((s) => s.toggleFavoritePlace);

  const credit = landmark
    ? t('spot.photoBy', { author: landmark.credit.author, license: landmark.credit.license }).replace(/:\s*,\s*/, ': ').replace(/,\s*,/g, ',')
    : photo && photo === extra.data?.image
      ? t('spot.photoSite')
      : null;

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-3 pb-3">
        <BackButton />
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${tint}1f`, color: tint }}>
          {glyph && !landmark ? <GlyphIcon glyph={glyph} className="size-5.5" /> : <Icon className="size-5.5" />}
        </span>
        <div className="min-w-0 flex-1">
          {kind && (
            <p className="text-[12px] font-semibold tracking-wide uppercase" style={{ color: tint }}>
              {kind}
            </p>
          )}
          <h1 className="text-[19px] leading-tight font-bold tracking-tight">{name || t('plan.mapPoint')}</h1>
        </div>
        {Number.isFinite(lat) && (
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? t('spot.unfavorite') : t('spot.favorite')}
            onClick={() => toggleFavorite({ path, name: name || t('plan.mapPoint'), lat, lon, kind: kind || undefined })}
            className={`press grid size-11 shrink-0 place-items-center rounded-full ${favorite ? 'bg-rose-500/12 text-rose-500' : 'bg-raised text-muted'}`}
          >
            <Heart className="size-5.5" fill={favorite ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {subtitle && <p className="-mt-1 mb-3 px-1 text-[14px] text-muted first-letter:uppercase">{subtitle}</p>}
      <div className="mb-3 flex gap-2">
        <Link to={`/routes?${plan}&start=1`} className="primary-fill press flex h-12 flex-1 items-center justify-center gap-2 rounded-full font-semibold">
          <Compass className="size-5 shrink-0" />
          {t('stop.directions')}
        </Link>
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" aria-label={t('spot.website')} className="press grid size-12 place-items-center rounded-full bg-raised text-primary">
            <Globe className="size-5" />
          </a>
        )}
        {phone && (
          <a href={`tel:${phone.replaceAll(' ', '')}`} aria-label={t('spot.phone')} className="press grid size-12 place-items-center rounded-full bg-raised text-primary">
            <Phone className="size-5" />
          </a>
        )}
      </div>

      {photo && <Photo src={photo} alt={name} about={about} wikiUrl={wiki.data?.url} />}

      {about && !photo && (
        <Card className="mb-3 px-4 py-3">
          <AboutText text={about} wikiUrl={wiki.data?.url} clamp="line-clamp-6" />
        </Card>
      )}

      {osm && isLoading && <RowSkeleton rows={2} />}
      {osm && isError && <Message>{t('spot.failed')}</Message>}
      {hours && (
        <Card className="mb-3">
          <Hours text={hours} />
        </Card>
      )}
      {(address || phone || website) && (
        <Card>
          <Divided>
            {address && (
              <InfoRow icon={<MapPin className="size-5" />} action={<CopyButton text={address} />}>
                <span className="block text-[13px] text-muted">{t('spot.address')}</span>
                {address}
              </InfoRow>
            )}
            {phone && (
              <InfoRow icon={<Phone className="size-5" />} action={<CopyButton text={phone} />}>
                <a href={`tel:${phone.replaceAll(' ', '')}`} className="font-medium text-primary">
                  {phone}
                </a>
              </InfoRow>
            )}
            {website && (
              <InfoRow icon={<Globe className="size-5" />}>
                <a href={website} target="_blank" rel="noopener noreferrer" className="font-medium break-all text-primary">
                  {website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                </a>
              </InfoRow>
            )}
          </Divided>
        </Card>
      )}
      <p className="mt-3 px-1 text-center text-[12px] text-muted">{[credit, osm ? t('spot.source') : null].filter(Boolean).join(' · ')}</p>
    </>
  );
}
