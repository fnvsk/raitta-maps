import { useCallback, useState, type SetStateAction } from 'react';
import { useLocation } from 'react-router-dom';

const kept = new Map<string, unknown>();
const KEPT_ENTRIES = 40;

export function useKeptState<T>(name: string, initial: T | (() => T)): [T, (next: SetStateAction<T>) => void] {
  const key = `${useLocation().key}:${name}`;
  const [value, setValue] = useState<T>(() => {
    if (kept.has(key)) return kept.get(key) as T;
    const first = typeof initial === 'function' ? (initial as () => T)() : initial;
    kept.set(key, first);
    return first;
  });
  const set = useCallback(
    (next: SetStateAction<T>) =>
      setValue((previous) => {
        const value = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
        kept.delete(key);
        kept.set(key, value);

        while (kept.size > KEPT_ENTRIES) kept.delete(kept.keys().next().value!);
        return value;
      }),
    [key],
  );
  return [value, set];
}

export function useWasKept(name: string) {
  const key = `${useLocation().key}:${name}`;
  const [again] = useState(() => {
    const seen = kept.has(key);
    kept.set(key, true);
    return seen;
  });
  return again;
}
