import { getCommunityGuidelines } from '../../content/legal/communityGuidelines';
import { getPrivacyPolicy } from '../../content/legal/privacyPolicy';
import { getTermsOfService } from '../../content/legal/termsOfService';
import { scrubContext } from '../../lib/crashReporting';
import { targetResize } from '../localMedia';
import { withVersion } from '../supabase/mediaUpload';

describe('recipe photo processing', () => {
  it('shrinks the longest edge to 1600px and never upscales', () => {
    expect(targetResize(4032, 3024)).toEqual({ width: 1600 });
    expect(targetResize(3024, 4032)).toEqual({ height: 1600 });
    expect(targetResize(1200, 900)).toBeNull();
    expect(targetResize(0, 0)).toBeNull();
  });
});

describe('uploaded photo URLs', () => {
  it('are versioned so a replaced photo is not served from cache', () => {
    expect(withVersion('https://x.supabase.co/storage/v1/object/public/recipe-media/u/r/photo', 123)).toBe(
      'https://x.supabase.co/storage/v1/object/public/recipe-media/u/r/photo?v=123',
    );
    expect(withVersion('https://x/y?a=1', 5)).toBe('https://x/y?a=1&v=5');
  });
});

describe('crash report context scrubbing', () => {
  it('redacts anything that looks like a credential or email', () => {
    expect(scrubContext({ module: 'm', action: 'a', recipeId: 'r', accessToken: 't', password: 'p', email: 'e@x', refresh_token: 'rt' })).toEqual({
      module: 'm',
      action: 'a',
      recipeId: 'r',
      accessToken: '[redacted]',
      password: '[redacted]',
      email: '[redacted]',
      refresh_token: '[redacted]',
    });
  });
});

describe('legal documents', () => {
  const docs = [getPrivacyPolicy, getTermsOfService, getCommunityGuidelines];

  it.each(docs.map((d) => [d.name, d] as const))('%s has matching Turkish and English structure', (_name, get) => {
    const en = get('en');
    const tr = get('tr');
    expect(tr.sections.length).toBe(en.sections.length);
    tr.sections.forEach((section, i) => {
      expect(section.paragraphs.length).toBe(en.sections[i].paragraphs.length);
      expect(section.bullets?.length ?? 0).toBe(en.sections[i].bullets?.length ?? 0);
    });
  });

  it('shows explicit placeholders — never invented values — when business details are not configured', () => {
    const text = JSON.stringify(getPrivacyPolicy('en'));
    expect(text).toContain('[legal entity name not yet configured]');
    expect(text).toContain('[support email not yet configured]');
    expect(text).not.toContain('undefined');
    expect(JSON.stringify(getPrivacyPolicy('tr'))).toContain('henüz yapılandırılmadı');
  });

  it('describes the real account-deletion path', () => {
    expect(JSON.stringify(getPrivacyPolicy('en'))).toContain('Profile → Delete account');
    expect(JSON.stringify(getPrivacyPolicy('tr'))).toContain('Profil → Hesabı sil');
  });
});
