import { noOpAdProvider } from './NoOpAdProvider';

/** Swap for a real network adapter to start serving ads; see AdProvider.ts. */
export const adProvider = noOpAdProvider;

export * from './AdProvider';
