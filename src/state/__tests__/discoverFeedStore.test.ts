import { useDiscoverFeedStore } from '../discoverFeedStore';

const mockFetchPublicRecipesPage = jest.fn();
jest.mock('../../data/community', () => ({
  get remoteRecipeBackend() {
    return { fetchPublicRecipesPage: (...a: unknown[]) => mockFetchPublicRecipesPage(...a) };
  },
}));

function recipe(id: string) {
  return { id, name: id, ownerId: 'someone', visibility: 'public' as const } as never;
}

describe('useDiscoverFeedStore', () => {
  beforeEach(() => {
    useDiscoverFeedStore.setState({ recipes: [], isLoading: false, hasError: false, nextCursor: null });
    mockFetchPublicRecipesPage.mockReset();
  });

  it('load() replaces the feed with the first page', async () => {
    mockFetchPublicRecipesPage.mockResolvedValueOnce({ recipes: [recipe('r1'), recipe('r2')], nextCursor: 'cursor-1' });
    await useDiscoverFeedStore.getState().load();
    const state = useDiscoverFeedStore.getState();
    expect(state.recipes.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(state.nextCursor).toBe('cursor-1');
    expect(state.isLoading).toBe(false);
    expect(state.hasError).toBe(false);
  });

  it('a failed load sets hasError and keeps isLoading false, without throwing', async () => {
    mockFetchPublicRecipesPage.mockRejectedValueOnce(new Error('network down'));
    await expect(useDiscoverFeedStore.getState().load()).resolves.toBeUndefined();
    const state = useDiscoverFeedStore.getState();
    expect(state.hasError).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('a failed load preserves whatever was already on screen', async () => {
    mockFetchPublicRecipesPage.mockResolvedValueOnce({ recipes: [recipe('r1')], nextCursor: null });
    await useDiscoverFeedStore.getState().load();
    mockFetchPublicRecipesPage.mockRejectedValueOnce(new Error('network down'));
    await useDiscoverFeedStore.getState().load();
    expect(useDiscoverFeedStore.getState().recipes.map((r) => r.id)).toEqual(['r1']);
  });

  it('loadMore() appends the next page and de-duplicates by id', async () => {
    mockFetchPublicRecipesPage.mockResolvedValueOnce({ recipes: [recipe('r1'), recipe('r2')], nextCursor: 'cursor-1' });
    await useDiscoverFeedStore.getState().load();
    mockFetchPublicRecipesPage.mockResolvedValueOnce({ recipes: [recipe('r2'), recipe('r3')], nextCursor: null });
    await useDiscoverFeedStore.getState().loadMore();
    const state = useDiscoverFeedStore.getState();
    expect(state.recipes.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(state.nextCursor).toBeNull();
  });

  it('loadMore() is a no-op once nextCursor is null (last page already reached)', async () => {
    useDiscoverFeedStore.setState({ recipes: [recipe('r1')], nextCursor: null });
    await useDiscoverFeedStore.getState().loadMore();
    expect(mockFetchPublicRecipesPage).not.toHaveBeenCalled();
  });

  it('loadMore() is a no-op while a load is already in flight', async () => {
    useDiscoverFeedStore.setState({ nextCursor: 'cursor-1', isLoading: true });
    await useDiscoverFeedStore.getState().loadMore();
    expect(mockFetchPublicRecipesPage).not.toHaveBeenCalled();
  });
});

describe('useDiscoverFeedStore — races and lookups', () => {
  beforeEach(() => {
    useDiscoverFeedStore.setState({ recipes: [], isLoading: false, hasError: false, nextCursor: null, byId: {} });
    mockFetchPublicRecipesPage.mockReset();
  });

  it('a slower, older load() response never overwrites a newer one', async () => {
    let resolveOld: (v: unknown) => void = () => undefined;
    mockFetchPublicRecipesPage
      .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
      .mockResolvedValueOnce({ recipes: [recipe('new')], nextCursor: null });
    const older = useDiscoverFeedStore.getState().load();
    await useDiscoverFeedStore.getState().load();
    resolveOld({ recipes: [recipe('old')], nextCursor: null });
    await older;
    expect(useDiscoverFeedStore.getState().recipes.map((r) => r.id)).toEqual(['new']);
  });

  it('feed pages are indexed by id for the recipe detail screen', async () => {
    mockFetchPublicRecipesPage.mockResolvedValueOnce({ recipes: [recipe('r1')], nextCursor: null });
    await useDiscoverFeedStore.getState().load();
    expect(await useDiscoverFeedStore.getState().fetchById('r1')).toMatchObject({ id: 'r1' });
  });
});
