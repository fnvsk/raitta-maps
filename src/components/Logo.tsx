export function LogoMark({ className, color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <path
        d="M21 50V14h17.5a12.5 12.5 0 0 1 0 25H21"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M38 39l11 11" stroke={color} strokeWidth={7} strokeLinecap="round" />
      <circle cx={37.5} cy={26.5} r={3.6} fill={color} />
    </svg>
  );
}

export function LoadingMark({ className = 'size-12', color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`r-loop ${className}`} fill="none" aria-hidden>
      <path d="M21 50V14h17.5a12.5 12.5 0 0 1 0 25H21" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M38 39l11 11" stroke={color} strokeWidth={7} strokeLinecap="round" />
      <circle cx={37.5} cy={26.5} r={3.6} fill={color} />
    </svg>
  );
}

export function LogoTile({ className = 'size-9' }: { className?: string }) {
  return (
    <span className={`${className} grid shrink-0 place-items-center rounded-[28%] bg-primary-strong`}>
      <LogoMark className="size-[78%]" color="#fff" />
    </span>
  );
}
