/**
 * Exports the in-app legal documents (the source of truth, src/content/legal)
 * to Markdown files for hosting at the public HTTPS URLs the stores require.
 *
 *   EXPO_PUBLIC_LEGAL_ENTITY_NAME=… EXPO_PUBLIC_SUPPORT_EMAIL=… … npm run legal:export
 *
 * Reads the same EXPO_PUBLIC_LEGAL_* / EXPO_PUBLIC_SUPPORT_EMAIL variables as
 * the app, so the hosted copy always matches what the app shows.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getCommunityGuidelines } from '../src/content/legal/communityGuidelines';
import { getPrivacyPolicy } from '../src/content/legal/privacyPolicy';
import { getTermsOfService } from '../src/content/legal/termsOfService';
import { LegalDoc } from '../src/content/legal/types';

const titles = {
  'privacy-policy': { en: 'Cellar — Privacy Policy', tr: 'Cellar — Gizlilik Politikası', get: getPrivacyPolicy },
  terms: { en: 'Cellar — Terms of Service', tr: 'Cellar — Kullanım Koşulları', get: getTermsOfService },
  'community-guidelines': { en: 'Cellar — Community Guidelines', tr: 'Cellar — Topluluk Kuralları', get: getCommunityGuidelines },
} as const;

function toMarkdown(title: string, doc: LegalDoc): string {
  const lines = [`# ${title}`, ''];
  const effective = process.env.EXPO_PUBLIC_LEGAL_EFFECTIVE_DATE;
  if (effective) lines.push(`_Effective ${effective}_`, '');
  for (const section of doc.sections) {
    lines.push(`## ${section.heading}`, '');
    for (const p of section.paragraphs) lines.push(p, '');
    for (const b of section.bullets ?? []) lines.push(`- ${b}`);
    if (section.bullets?.length) lines.push('');
  }
  return lines.join('\n');
}

const outDir = join(__dirname, '..', 'legal', 'generated');
mkdirSync(outDir, { recursive: true });
for (const [slug, meta] of Object.entries(titles)) {
  for (const locale of ['en', 'tr'] as const) {
    const file = join(outDir, `${slug}.${locale}.md`);
    writeFileSync(file, toMarkdown(meta[locale], meta.get(locale)));
    console.log('wrote', file);
  }
}
