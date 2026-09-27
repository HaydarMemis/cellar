import { PluralString } from './types';

export interface TranslateOptions {
  count?: number;
  [key: string]: string | number | undefined;
}

/**
 * Pure lookup/interpolation/pluralization logic, factored out of
 * useTranslation() so it's testable without React (no locale subscription,
 * no hooks) — useTranslation just wires a resolved dictionary into these.
 */
export function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export function isPluralString(value: unknown): value is PluralString {
  return !!value && typeof value === 'object' && 'one' in value && 'other' in value;
}

export function interpolate(template: string, options?: TranslateOptions): string {
  if (!options) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, token: string) => {
    const value = options[token];
    return value === undefined ? match : String(value);
  });
}

export function resolveLeaf(raw: unknown, options?: TranslateOptions): string {
  if (typeof raw === 'string') return interpolate(raw, options);
  if (isPluralString(raw)) return interpolate(options?.count === 1 ? raw.one : raw.other, options);
  return '';
}

/** Looks up `key` in `dict` and resolves it (interpolating/pluralizing); returns the raw key itself if nothing is found there, so a missing translation renders as a visible key rather than blank. */
export function translateFrom(dict: unknown, key: string, options?: TranslateOptions): string {
  const raw = getByPath(dict, key);
  return raw === undefined ? key : resolveLeaf(raw, options);
}
