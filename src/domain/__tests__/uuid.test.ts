import { isUuid, matchesRecipeId, remoteRecipeId, sha1, uuidV4FromBytes, uuidV5 } from '../uuid';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

describe('sha1', () => {
  // FIPS 180 / widely published test vectors.
  it.each([
    ['', 'da39a3ee5e6b4b0d3255bfef95601890afd80709'],
    ['abc', 'a9993e364706816aba3e25717850c26c9cd0d89d'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '84983e441c3bd26ebaae4aa1f95129e5e54670f1'],
    ['a'.repeat(1000000), '34aa973cd4c4daa4f61eeb2bdbad27316534016f'],
  ])('matches the published vector for input #%#', (input, expected) => {
    expect(hex(sha1(new TextEncoder().encode(input)))).toBe(expected);
  });
});

describe('uuidV5', () => {
  it('matches the well-known RFC 4122 DNS-namespace vector', () => {
    expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });
});

describe('uuidV4FromBytes', () => {
  it('sets version 4 and the RFC variant bits', () => {
    const id = uuidV4FromBytes(new Uint8Array(16).fill(0xff));
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe('4');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });
});

describe('remoteRecipeId — legacy local recipe ids must map to a uuid the recipes table accepts', () => {
  it('maps a legacy recipe-… id to a valid, stable uuid', () => {
    const legacy = 'recipe-lz3k9w1-ab12cd34';
    const first = remoteRecipeId(legacy);
    expect(isUuid(first)).toBe(true);
    expect(remoteRecipeId(legacy)).toBe(first); // deterministic across calls/app runs
    expect(first).not.toBe(remoteRecipeId('recipe-lz3k9w1-ab12cd35'));
  });

  it('leaves an id that is already a uuid unchanged (lower-cased)', () => {
    expect(remoteRecipeId('0F8FAD5B-D9CB-469F-A165-70867728950E')).toBe('0f8fad5b-d9cb-469f-a165-70867728950e');
  });

  it('matchesRecipeId resolves a Discover row (remote id) back to the local recipe', () => {
    const legacy = 'recipe-old-1';
    expect(matchesRecipeId(legacy, legacy)).toBe(true);
    expect(matchesRecipeId(legacy, remoteRecipeId(legacy))).toBe(true);
    expect(matchesRecipeId(legacy, remoteRecipeId('recipe-old-2'))).toBe(false);
  });
});
