import type { ReactNode } from 'react';
import type { Language } from '@/i18n';

const FLAGS: Record<Language, ReactNode> = {
  fi: (
    <>
      <path fill="#fff" d="M0 0h24v16H0z" />
      <path fill="#003580" d="M7 0h4v16H7zM0 6h24v4H0z" />
    </>
  ),
  en: (
    <>
      <path fill="#012169" d="M0 0h24v16H0z" />
      <path stroke="#fff" strokeWidth="3.2" d="m0 0 24 16M24 0 0 16" />
      <path stroke="#C8102E" strokeWidth="1.2" d="m0 0 24 16M24 0 0 16" />
      <path fill="#fff" d="M10 0h4v16h-4zM0 6h24v4H0z" />
      <path fill="#C8102E" d="M10.8 0h2.4v16h-2.4zM0 6.8h24v2.4H0z" />
    </>
  ),
  sv: (
    <>
      <path fill="#006AA7" d="M0 0h24v16H0z" />
      <path fill="#FECC02" d="M7 0h3.2v16H7zM0 6.4h24v3.2H0z" />
    </>
  ),
  ru: (
    <>
      <path fill="#fff" d="M0 0h24v5.34H0z" />
      <path fill="#0039A6" d="M0 5.33h24v5.34H0z" />
      <path fill="#D52B1E" d="M0 10.66h24V16H0z" />
    </>
  ),
  et: (
    <>
      <path fill="#0072CE" d="M0 0h24v5.34H0z" />
      <path fill="#000" d="M0 5.33h24v5.34H0z" />
      <path fill="#fff" d="M0 10.66h24V16H0z" />
    </>
  ),
};

export function Flag({ language, className = 'h-[18px] w-[27px]', round = false }: { language: Language; className?: string; round?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 16"
      preserveAspectRatio={round ? 'xMidYMid slice' : undefined}
      aria-hidden
      className={`${className} shrink-0 overflow-hidden ${round ? 'rounded-full' : 'rounded-[3px]'} ${className.includes('ring-') ? '' : 'ring-1 ring-black/15'}`}
    >
      {FLAGS[language]}
    </svg>
  );
}
