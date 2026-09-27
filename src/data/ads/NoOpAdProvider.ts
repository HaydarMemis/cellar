import { AdCreative, AdPlacement, AdProvider } from './AdProvider';

/** No ad network is integrated in this build (no ad-network account exists to connect). Always resolves to no ad, so AdSlot renders nothing. */
export const noOpAdProvider: AdProvider = {
  async getAd(_placement: AdPlacement): Promise<AdCreative | null> {
    return null;
  },
};
