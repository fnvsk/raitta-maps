import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSheetSnap } from '@/components/Panel';
import { BackButton, Segmented } from '@/components/ui';
import { isNativeApp } from '@/platform';
import { useUi } from '@/state/ui';
import { ANDROID_PRIVACY_POLICY, PRIVACY_POLICY, type PolicyLanguage } from './privacyPolicy';

export function PrivacyPage() {
  const { i18n } = useTranslation();
  useSheetSnap('full');
  const setFocus = useUi((s) => s.setFocus);
  const [language, setLanguage] = useState<PolicyLanguage>(i18n.language === 'fi' ? 'fi' : 'en');

  const [which, setWhich] = useState<'general' | 'android'>(isNativeApp ? 'android' : 'general');
  const policy = (which === 'android' ? ANDROID_PRIVACY_POLICY : PRIVACY_POLICY)[language];

  useEffect(() => setFocus({}), [setFocus]);

  return (
    <div lang={language}>
      <div data-sheet-drag className="flex touch-none items-center gap-1 pb-3">
        <BackButton fallback="/settings" />
        <h1 className="min-w-0 truncate text-[22px] font-bold tracking-tight">{policy.title}</h1>
      </div>
      <Segmented<PolicyLanguage>
        value={language}
        onChange={setLanguage}
        options={[
          { value: 'en', label: 'English' },
          { value: 'fi', label: 'Suomi' },
        ]}
      />
      {isNativeApp && (
        <div className="mt-2">
          <Segmented<'general' | 'android'>
            value={which}
            onChange={setWhich}
            options={[
              { value: 'android', label: 'Android' },
              { value: 'general', label: language === 'fi' ? 'Yleinen' : 'General' },
            ]}
          />
        </div>
      )}
      <p className="mt-3 px-1 text-[13px] text-muted">{policy.effective}</p>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {policy.summary.map((point) => (
          <li key={point} className="rounded-2xl bg-raised p-3 text-[14px] font-medium leading-snug">
            {point}
          </li>
        ))}
      </ul>
      {policy.sections.map((section) => (
        <section key={section.id} className="mt-6 px-1 text-[15px] leading-relaxed">
          <h2 className="mb-1.5 text-[17px] font-semibold">{section.title}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="mb-2">
              {paragraph}
            </p>
          ))}
          {section.table && (
            <div className="-mx-1 space-y-2">
              {section.table.rows.map((row) => (
                <dl key={row[0]} className="rounded-2xl bg-raised p-3 text-[14px]">
                  <dt className="mb-1 font-semibold">{row[0]}</dt>
                  {row.slice(1).map((cell, i) => (
                    <dd key={i} className="mt-1">
                      <span className="text-muted">{section.table!.head[i + 1]}: </span>
                      {cell}
                    </dd>
                  ))}
                </dl>
              ))}
            </div>
          )}
          {section.items && (
            <ul className="list-disc space-y-1.5 pl-5">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
