import { Check, ChevronRight, Download, MessageSquareText, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Flag } from '@/components/Flag';
import { useSheetSnap } from '@/components/Panel';
import { BackButton, Card, Divided, SectionTitle, Segmented, SupportButton, Toggle } from '@/components/ui';
import type { WalkingPace } from '@/core/raptor';
import { useRegion } from '@/data/hooks';
import { LANGUAGES } from '@/i18n';
import { isNativeApp, SITE } from '@/platform';
import { isIos, isStandalone, promptInstall, useCanInstall } from '@/pwa';
import { startLocating, stopLocating } from '@/map/location';
import { useSettings, type ThemeSetting } from '@/state/settings';
import { useUi } from '@/state/ui';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  useSheetSnap('full');
  const setFocus = useUi((s) => s.setFocus);
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const noLocation = useSettings((s) => s.noLocation);
  const setNoLocation = useSettings((s) => s.setNoLocation);
  const setLanguage = useSettings((s) => s.setLanguage);
  const languageNames = useMemo(() => new Intl.DisplayNames([i18n.language], { type: 'language' }), [i18n.language]);
  const walkingPace = useSettings((s) => s.walkingPace);
  const setWalkingPace = useSettings((s) => s.setWalkingPace);
  const saveHistory = useSettings((s) => s.saveHistory);
  const setSaveHistory = useSettings((s) => s.setSaveHistory);
  const recentCount = useSettings((s) => s.recentPlaces.length);
  const forgetPlaces = useSettings((s) => s.forgetPlaces);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const canInstall = useCanInstall();
  const region = useRegion();

  useEffect(() => setFocus({}), [setFocus]);

  const updated = region.info && new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(region.info.generatedAt));

  const deleteEverything = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    useSettings.persist.clearStorage();
    window.location.reload();
  };

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-1 pb-1">
        <BackButton />
        <h1 className="text-[22px] font-bold tracking-tight">{t('settings.title')}</h1>
      </div>

      <SectionTitle>{t('settings.region')}</SectionTitle>
      <Link to="/regions" className="surface-card flex items-center justify-between rounded-card px-4 py-3 font-medium">
        {region.name}
        <ChevronRight className="size-5 text-(--muted-icon)" />
      </Link>

      <SectionTitle>{t('settings.language')}</SectionTitle>
      <div className="grid gap-2" role="radiogroup" aria-label={t('settings.language')}>
        {LANGUAGES.map(({ code, label }) => {
          const chosen = i18n.language === code;
          const inCurrent = languageNames.of(code) ?? '';
          const hint = inCurrent.toLocaleLowerCase(i18n.language) === label.toLocaleLowerCase(code) ? '' : inCurrent;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={chosen}
              onClick={() => setLanguage(code)}
              className={`press flex w-full items-center gap-3.5 rounded-card border-2 px-3.5 py-3 text-left transition-colors ${
                chosen ? 'border-primary bg-primary-soft' : 'surface-card border-transparent'
              }`}
            >
              <Flag language={code} round className="size-9" />
              <span className="min-w-0 flex-1">
                <span lang={code} className="block text-[16px] leading-tight font-semibold">
                  {label}
                </span>
                {hint && <span className="mt-0.5 block text-[13px] leading-tight text-muted first-letter:uppercase">{hint}</span>}
              </span>
              <span
                aria-hidden
                className={`grid size-6 shrink-0 place-items-center rounded-full transition-colors ${chosen ? 'primary-fill' : 'border-2 border-hairline'}`}
              >
                {chosen && <Check className="size-4" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <SectionTitle>{t('settings.theme')}</SectionTitle>
      <Segmented<ThemeSetting>
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'system', label: t('settings.themeSystem') },
          { value: 'light', label: t('settings.themeLight') },
          { value: 'dark', label: t('settings.themeDark') },
        ]}
      />

      <SectionTitle>{t('settings.location')}</SectionTitle>
      <Card className="mb-1 px-3 py-1">
        <Toggle
          label={t('settings.useLocation')}
          checked={!noLocation}
          onChange={() => {
            if (noLocation) startLocating(true);
            else {
              setNoLocation(true);
              stopLocating();
            }
          }}
        />
      </Card>
      <p className="mb-1 px-1 text-[13px] text-muted">{t('settings.useLocationHint')}</p>

      <SectionTitle>{t('settings.routes')}</SectionTitle>
      <p className="mb-1.5 px-1 text-[13px] font-medium text-muted">{t('settings.walkingSpeed')}</p>
      <Segmented<WalkingPace>
        value={walkingPace}
        onChange={setWalkingPace}
        options={[
          { value: 'slow', label: t('settings.paceSlow') },
          { value: 'normal', label: t('settings.paceNormal') },
          { value: 'fast', label: t('settings.paceFast') },
        ]}
      />

      {!isNativeApp && <SectionTitle>{t('settings.install')}</SectionTitle>}
      {!isNativeApp && <Card className="p-4">
        {isStandalone() ? (
          <p>{t('settings.installed')}</p>
        ) : canInstall ? (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="primary-fill press flex h-11 w-full items-center justify-center gap-2 rounded-full font-semibold"
          >
            <Download className="size-[18px]" />
            {t('settings.installAction')}
          </button>
        ) : (
          <p className="text-muted">{t(isIos() ? 'settings.installIos' : 'settings.installBrowser')}</p>
        )}
      </Card>}

      <SectionTitle>{t('settings.feedback')}</SectionTitle>
      <Card className="mb-2.5">
        <a
          href={`${SITE}/feedback?lang=${i18n.language}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-4 py-3 active:bg-raised"
        >
          <MessageSquareText className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t('settings.feedbackSend')}</span>
            <span className="block text-[13px] text-muted">{t('settings.feedbackHint')}</span>
          </span>
          <ChevronRight className="size-5 text-(--muted-icon)" />
        </a>
      </Card>

      <div className="mb-2.5">
        <SupportButton />
      </div>

      <SectionTitle>{t('settings.privacy')}</SectionTitle>
      <Card>
        <Divided>
          <Link to="/privacy" className="flex items-center justify-between px-4 py-3 font-medium active:bg-raised">
            {t('settings.privacyPolicy')}
            <ChevronRight className="size-5 text-(--muted-icon)" />
          </Link>
          <div className="px-3 py-1">
            <Toggle label={t('settings.saveHistory')} checked={saveHistory} onChange={() => setSaveHistory(!saveHistory)} />
          </div>
          {recentCount > 0 && (
            <button type="button" onClick={forgetPlaces} className="w-full px-4 py-3 text-left font-medium text-primary active:bg-raised">
              {t('settings.clearHistory')}
            </button>
          )}
          <button type="button" onClick={deleteEverything} className="flex w-full items-center gap-2.5 px-4 py-3 text-left font-medium text-rose-500 active:bg-raised">
            <Trash2 className="size-5 shrink-0" />
            {t(confirmingDelete ? 'settings.deleteConfirm' : 'settings.deleteData')}
          </button>
        </Divided>
      </Card>

      <p className="tabular mt-4 px-1 text-center text-[12px] text-muted">
        {updated && `${t('settings.timetableUpdated', { date: updated })} · `}
        {__BUILD_TIME__}
      </p>
    </>
  );
}
