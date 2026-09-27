import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { isSupabaseConfigured } from '../../data/supabase/client';
import { useTranslation } from '../../i18n/useTranslation';
import { reportError } from '../../lib/crashReporting';
import { useAuthStore } from '../../state/authStore';
import {
  AdoptableData,
  adoptLocalData,
  findAdoptableData,
  rememberAdoptionDeclined,
  totalAdoptable,
  wasAdoptionDeclined,
} from '../../state/localDataAdoption';

/**
 * Renders nothing. Whenever a DIFFERENT account becomes signed in (email,
 * Apple, Google, confirmation link, password-recovery link, or a restored
 * session on launch), checks whether this device holds guest or legacy
 * device-only data that this account can't see, and offers once to add it.
 * See src/state/localDataAdoption.ts.
 */
export function LocalDataAdoptionPrompt() {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.profile?.id ?? null);
  const handledFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || handledFor.current === userId) return;
    handledFor.current = userId;
    let cancelled = false;

    (async () => {
      const data = await findAdoptableData(userId, isSupabaseConfigured);
      if (cancelled || totalAdoptable(data) === 0) return;
      if (await wasAdoptionDeclined(userId, data)) return;
      if (cancelled || useAuthStore.getState().profile?.id !== userId) return;

      const summary = describe(data, t);
      Alert.alert(t('adoption.title'), t('adoption.message', { summary }), [
        { text: t('adoption.keepSeparate'), style: 'cancel', onPress: () => void rememberAdoptionDeclined(userId, data) },
        {
          text: t('adoption.addToAccount'),
          onPress: async () => {
            // Re-check identity at tap time — never adopt into an account
            // that signed out while the dialog was open.
            if (useAuthStore.getState().profile?.id !== userId) return;
            try {
              await adoptLocalData(userId, data.ownerIds);
              Alert.alert(t('adoption.doneTitle'));
            } catch (e) {
              reportError(e, { module: 'LocalDataAdoptionPrompt', action: 'adopt' });
              Alert.alert(t('adoption.failedTitle'), t('adoption.failedMessage'));
            }
          },
        },
      ]);
    })().catch((e) => reportError(e, { module: 'LocalDataAdoptionPrompt', action: 'check' }));

    return () => {
      cancelled = true;
    };
  }, [userId, t]);

  // Signed out: reset so the next sign-in (possibly the same account) is checked again.
  useEffect(() => {
    if (!userId) handledFor.current = null;
  }, [userId]);

  return null;
}

function describe(data: AdoptableData, t: ReturnType<typeof useTranslation>['t']): string {
  const parts: string[] = [];
  if (data.recipes) parts.push(t('adoption.recipes', { count: data.recipes }));
  if (data.favorites) parts.push(t('adoption.favorites', { count: data.favorites }));
  if (data.inventory) parts.push(t('adoption.inventory', { count: data.inventory }));
  if (data.journal) parts.push(t('adoption.journal', { count: data.journal }));
  if (data.shoppingList) parts.push(t('adoption.shoppingList', { count: data.shoppingList }));
  return parts.join(', ');
}
