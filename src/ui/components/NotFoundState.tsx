import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../theme/useTheme';
import { Button } from './Button';
import { Screen } from './Screen';
import { Text } from './Text';

/**
 * Shared "not found / couldn't load" state for detail screens. These routes
 * hide the navigation header, so without an explicit way out a deep link to a
 * missing item was a dead end. Goes back when there is somewhere to go back
 * to, otherwise to the app's home tabs.
 */
export function NotFoundState({ message, loading }: { message: string; loading?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <Screen>
      <View style={[styles.wrap, { paddingTop: insets.top + 40 }]}>
        {loading ? (
          <ActivityIndicator color={theme.colors.textSecondary} />
        ) : (
          <>
            <Text variant="headline" style={styles.message}>
              {message}
            </Text>
            <Button label={t('common.goBack')} variant="secondary" onPress={leave} style={styles.button} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, alignItems: 'center' },
  message: { textAlign: 'center', marginBottom: 12 },
  button: { alignSelf: 'stretch', marginTop: 8 },
});
