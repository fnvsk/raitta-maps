import { Check, Globe, LocateFixed, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingMark, LogoMark } from '@/components/Logo';
import { Flag } from '@/components/Flag';
import { Moose } from '@/components/Moose';
import { REGIONS, regionAt, regionName } from '@/core/regions';
import { useRegionPhotos, useRegions } from '@/data/hooks';
import { LANGUAGES } from '@/i18n';
import { startLocating } from '@/map/location';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';

const LOCATE_TIMEOUT_MS = 15_000;
const CITY_ZOOM = 13;

type Step = 'intro' | 'locate' | 'locating' | 'pick' | 'city';

function Skyline() {
  return (
    <svg viewBox="0 0 390 240" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-[46%] w-full" aria-hidden>
      <path d="M0 150c70-34 130-30 190-12s130 12 200-18v120H0z" fill="#2478F2" opacity={0.55} />
      <g fill="#0F4CC9">
        <path d="M150 170V62h3v-8h1V10h2v44h1v8h3v108z" />
        <path d="M143 66c0-5 26-5 26 0 0 7-6 9-13 9s-13-2-13-9z" />
        <path d="M20 180v-34h22v-12h20v46zM68 180v-24h16v-14h26v38zM178 180v-30h24v-16h18v46zM226 180v-20h20v-22h28v42zM282 180v-30h22v14h26v-24h20v40z" />
      </g>
      <path d="M0 178c60-14 110-10 170 0s140 12 220-6v68H0z" fill="#0F4CC9" />
      <path d="M0 198c80-12 150-6 210 2s120 8 180-6v46H0z" fill="#0B3EA8" />
    </svg>
  );
}

function RTile({ className = 'size-20' }: { className?: string }) {
  return (
    <span className={`${className} grid shrink-0 place-items-center rounded-[28%] bg-primary-strong shadow-[0_10px_30px_rgb(0_0_0/0.25)] ring-4 ring-white/90`}>
      <LogoMark className="r-draw size-[72%]" color="#fff" />
    </span>
  );
}

const primaryButton = 'press flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[17px] font-semibold text-primary-strong';
const secondaryButton = 'press h-12 w-full rounded-full text-[16px] font-semibold text-white/90';

export function Welcome() {
  const { t, i18n } = useTranslation();
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const setLanguage = useSettings((s) => s.setLanguage);
  const setRegion = useSettings((s) => s.setRegion);
  const regionId = useSettings((s) => s.region);
  const location = useUi((s) => s.location);
  const locationError = useUi((s) => s.locationError);
  const flyTo = useUi((s) => s.flyTo);
  const setCityChosen = useUi((s) => s.setCityChosen);
  const { data: regions } = useRegions();
  const { data: photos } = useRegionPhotos();
  const [step, setStep] = useState<Step>('intro');
  const [outside, setOutside] = useState(false);

  const cities = useMemo(
    () =>
      (regions ?? [])
        .flatMap((info) => {
          const config = REGIONS.find((r) => r.id === info.id);
          return config ? [{ info, name: regionName(config, i18n.language) }] : [];
        })
        .sort((a, b) => a.name.localeCompare(b.name, i18n.language)),
    [regions, i18n.language],
  );

  const choose = (id: string) => {
    const info = regions?.find((r) => r.id === id);
    setRegion(id);
    if (info) flyTo({ ...info.center, zoom: CITY_ZOOM });
    setCityChosen();
    setStep('city');
  };

  useEffect(() => {
    if (step !== 'locating') return;
    if (location && regions) {
      const here = regionAt(regions, location);
      if (here) choose(here.id);
      else {
        setOutside(true);
        setStep('pick');
      }
    } else if (locationError) setStep('pick');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, location, locationError, regions]);

  useEffect(() => {
    if (step !== 'locating') return;
    const timer = setTimeout(() => setStep('pick'), LOCATE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [step]);

  const city = cities.find((c) => c.info.id === regionId);
  const photo = photos?.[regionId];

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-primary-strong text-white" style={{ colorScheme: 'light' }}>
      {step === 'city' && photo ? (
        <>
          <img
            src={photo.large ?? photo.url}
            alt=""
            decoding="async"
            onLoad={(event) => event.currentTarget.classList.add('loaded')}
            className="welcome-photo absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0e1526]/40 via-[#0e1526]/50 to-[#0e1526]/90" />
        </>
      ) : (
        <Skyline />
      )}

      <div className="safe-top relative flex flex-1 flex-col items-center overflow-y-auto px-6 text-center">
        {step === 'intro' && (
          <div key="intro" className="welcome-step flex flex-1 flex-col items-center justify-center pb-[34dvh]">
            <LogoMark className="r-draw size-24" color="#fff" />
            <h1 className="mt-3 text-[46px] leading-none font-bold tracking-[0.08em]">RAITTA</h1>
            <p className="mt-3 text-[19px] font-medium">{t('tagline')}</p>
            <p className="mt-1 max-w-72 text-[15px] text-white/85">{t('welcome.subtitle')}</p>
            <p className="mt-7 flex items-center gap-1.5 text-[13px] font-semibold tracking-wide text-white/75 uppercase">
              <Globe className="size-4" />
              {t('settings.language')}
            </p>
            <div className="mt-2.5 flex max-w-[360px] flex-wrap justify-center gap-2" role="radiogroup" aria-label={t('settings.language')}>
              {LANGUAGES.map(({ code, label }) => {
                const chosen = i18n.language === code;
                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    lang={code}
                    onClick={() => setLanguage(code)}
                    className={`press flex h-11 items-center gap-2 rounded-full pr-4 pl-1.5 text-[15px] font-semibold transition-colors ${
                      chosen ? 'bg-white text-primary-strong shadow-[0_10px_24px_-10px_rgb(8_20_60/0.6)]' : 'bg-white/15 text-white ring-1 ring-white/20'
                    }`}
                  >
                    <Flag language={code} round className="size-8 ring-2 ring-white/60" />
                    {label}
                    {chosen && <Check className="-mr-1 size-4" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(step === 'locate' || step === 'locating') && (
          <div key="locate" className="welcome-step flex flex-1 flex-col items-center justify-center pb-[30dvh]">
            <span className="welcome-pin relative grid size-24 place-items-center rounded-full bg-white/15">
              {step === 'locating' ? <LoadingMark className="size-14" color="#fff" /> : <MapPin className="size-12" strokeWidth={2.2} />}
            </span>
            <h1 className="mt-6 text-[30px] leading-tight font-bold">{t(step === 'locating' ? 'welcome.locating' : 'welcome.whereTitle')}</h1>
            <p className="mt-3 max-w-80 text-[16px] text-white/85">{t('welcome.whereText')}</p>
          </div>
        )}

        {step === 'pick' && (
          <div key="pick" className="welcome-step w-full max-w-md pt-10 pb-6">
            <h1 className="text-[28px] leading-tight font-bold">{t('welcome.pickTitle')}</h1>
            <p className="mt-2 text-[15px] text-white/85">{t(outside ? 'welcome.outside' : 'welcome.pickText')}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {cities.map(({ info, name }) => (
                <button
                  key={info.id}
                  type="button"
                  onClick={() => choose(info.id)}
                  className="press relative h-20 overflow-hidden rounded-2xl bg-white/15 text-left"
                >
                  {photos?.[info.id] && <img src={photos[info.id].url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-2 left-3 text-[16px] font-bold">{name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'city' && (
          <div key="city" className="welcome-step flex flex-1 flex-col items-center justify-center pb-[22dvh]">
            <RTile className="size-24" />
            <p className="mt-6 text-[20px] font-medium text-white/90">{t('welcome.hello')}</p>
            <h1 className="welcome-city mt-1 text-[52px] leading-none font-bold tracking-tight drop-shadow-[0_4px_20px_rgb(0_0_0/0.35)]">{city?.name}</h1>
            <p className="mt-4 max-w-80 text-[16px] text-white/90">{t('welcome.cityText')}</p>
          </div>
        )}
      </div>

      {step !== 'pick' && (
        <Moose
          say={t(step === 'intro' ? 'welcome.mooseHi' : step === 'city' ? 'welcome.mooseCity' : 'welcome.mooseWhere')}
          className="pointer-events-auto absolute right-[5%] bottom-[calc(max(24px,var(--safe-bottom))+120px)] z-[1] w-[min(34vw,150px)]"
        />
      )}
      <div className="relative space-y-1 px-6 pb-[max(24px,var(--safe-bottom))]">
        {step === 'intro' && (
          <button type="button" onClick={() => setStep('locate')} className={primaryButton}>
            {t('welcome.start')}
          </button>
        )}
        {(step === 'locate' || step === 'locating') && (
          <>
            <button
              type="button"
              disabled={step === 'locating'}
              onClick={() => {
                setStep('locating');
                startLocating(true);
              }}
              className={`${primaryButton} disabled:opacity-70`}
            >
              <LocateFixed className="size-5" />
              {t('welcome.allowLocation')}
            </button>
            <button
              type="button"
              onClick={() => {
                useSettings.getState().setNoLocation(true);
                setStep('pick');
              }}
              className={secondaryButton}
            >
              {t('welcome.chooseCity')}
            </button>
          </>
        )}
        {step === 'city' && (
          <button type="button" onClick={setOnboarded} className={primaryButton}>
            {t('welcome.go')}
          </button>
        )}
      </div>
      {step === 'city' && photo && (
        <p className="relative px-6 pb-2 text-center text-[11px] text-white/60">
          {photo.author}, {photo.license}, Wikimedia Commons
        </p>
      )}
    </div>
  );
}
