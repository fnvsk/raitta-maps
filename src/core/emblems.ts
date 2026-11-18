const files = import.meta.glob<string>('../assets/emblems/*.webp', { eager: true, import: 'default' });

export const EMBLEMS: Record<string, string> = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]));

export const emblemOf = (region: string): string | undefined => EMBLEMS[region];
