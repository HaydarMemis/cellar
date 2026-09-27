import { isRemoteMediaUrl } from '../mediaUpload';

/**
 * `uploadRecipeMedia`/`removeRecipeMedia` themselves need a real device
 * filesystem (expo-file-system's native `File` class) and a live Supabase
 * project to exercise meaningfully — not something Jest can do — but the
 * decision this module makes ("is this already a remote URL, or a local
 * device URI that still needs uploading?") is a pure function and the
 * single most important piece of logic to get right: getting it wrong
 * either re-uploads unchanged media on every publish, or — the bug this
 * whole module exists to fix — writes a local file:// URI into the
 * database as if it were public media.
 */
describe('isRemoteMediaUrl', () => {
  it('treats https URLs as remote', () => {
    expect(isRemoteMediaUrl('https://example.supabase.co/storage/v1/object/public/recipe-media/u/r/photo')).toBe(true);
  });

  it('treats http URLs as remote', () => {
    expect(isRemoteMediaUrl('http://localhost:54321/storage/v1/object/public/recipe-media/u/r/photo')).toBe(true);
  });

  it('treats a local iOS file:// URI as not remote', () => {
    expect(isRemoteMediaUrl('file:///var/mobile/Containers/Data/Application/ABC/tmp/image.jpg')).toBe(false);
  });

  it('treats a local Android content:// URI as not remote', () => {
    expect(isRemoteMediaUrl('content://media/external/images/media/1234')).toBe(false);
  });

  it('treats a ph:// (iOS Photos) asset URI as not remote', () => {
    expect(isRemoteMediaUrl('ph://ABCDEF01-2345-6789-ABCD-EF0123456789/L0/001')).toBe(false);
  });

  it('treats an empty string as not remote (defensive — should never actually reach this function)', () => {
    expect(isRemoteMediaUrl('')).toBe(false);
  });
});
