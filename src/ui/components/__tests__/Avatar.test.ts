import { avatarInitial, avatarInitialMetrics, shouldShowAvatarImage } from '../Avatar';

describe('Avatar photo fallback', () => {
  const photo = 'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars/u/avatar?v=1';

  it('shows the monogram when there is no photo', () => {
    expect(shouldShowAvatarImage(undefined, null)).toBe(false);
    expect(shouldShowAvatarImage('', null)).toBe(false);
  });

  it('shows the photo when there is one that has not failed', () => {
    expect(shouldShowAvatarImage(photo, null)).toBe(true);
  });

  it('falls back to the monogram after that photo failed to load', () => {
    expect(shouldShowAvatarImage(photo, photo)).toBe(false);
  });

  it('a NEW photo (new cache-buster) is tried again after an earlier failure', () => {
    expect(shouldShowAvatarImage(photo.replace('v=1', 'v=2'), photo)).toBe(true);
  });
});

describe('Avatar monogram', () => {
  it('uses the first character, upper-cased, with Turkish casing for Turkish names', () => {
    expect(avatarInitial('haydar')).toBe('H');
    expect(avatarInitial('  ada ')).toBe('A');
    expect(avatarInitial('ismail Şahin')).toBe('İ');
    expect(avatarInitial('ılgaz Çelik')).toBe('I');
    expect(avatarInitial('Émile')).toBe('É');
    expect(avatarInitial('')).toBe('?');
  });

  it('never splits a surrogate pair', () => {
    expect(avatarInitial('𝒜lice')).toBe('𝒜');
  });

  it('line box equals the font size at every avatar size, so the glyph is vertically centered', () => {
    for (const size of [22, 28, 40, 44, 72, 96]) {
      const m = avatarInitialMetrics(size);
      expect(m.lineHeight).toBe(m.fontSize);
      expect(m.fontSize).toBeLessThan(size);
    }
  });
});
