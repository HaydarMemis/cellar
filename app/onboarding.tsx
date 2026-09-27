import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, View, ViewToken } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../src/i18n/useTranslation';
import { Button } from '../src/ui/components/Button';
import { Screen } from '../src/ui/components/Screen';
import { Text } from '../src/ui/components/Text';
import { useOnboardingStore } from '../src/state/onboardingStore';
import { useTheme } from '../src/theme/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Page {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: 'onboarding.page1Title' | 'onboarding.page2Title' | 'onboarding.page3Title';
  bodyKey: 'onboarding.page1Body' | 'onboarding.page2Body' | 'onboarding.page3Body';
}

const pages: Page[] = [
  { icon: 'wine-outline', titleKey: 'onboarding.page1Title', bodyKey: 'onboarding.page1Body' },
  { icon: 'flask-outline', titleKey: 'onboarding.page2Title', bodyKey: 'onboarding.page2Body' },
  { icon: 'people-outline', titleKey: 'onboarding.page3Title', bodyKey: 'onboarding.page3Body' },
];

/**
 * First-launch, shown once (see useOnboardingStore) — never gates the
 * app, both CTAs lead straight into the real Cellar experience. "Sign
 * in" is offered, never required: this app's entire core discovery
 * experience works fully signed-out, and nothing here should suggest
 * otherwise. A plain paging FlatList + dot indicator (native iOS
 * onboarding pattern), not a custom gesture carousel — no new dependency,
 * no bounce/particle/cinematic effects per the brief. The one animation
 * (a fade-in per page as it becomes visible) is skipped entirely when the
 * OS's reduce-motion setting is on.
 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const complete = useOnboardingStore((s) => s.complete);
  const reducedMotion = useReducedMotion();

  const [pageIndex, setPageIndex] = useState(0);
  const listRef = useRef<FlatList<Page>>(null);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first && typeof first.index === 'number') setPageIndex(first.index);
  }, []);

  const goToNext = () => {
    if (pageIndex < pages.length - 1) {
      listRef.current?.scrollToIndex({ index: pageIndex + 1, animated: true });
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    complete();
    router.replace('/(tabs)');
  };

  const handleSignIn = () => {
    complete();
    router.replace('/(tabs)');
    router.push('/auth');
  };

  const isLastPage = pageIndex === pages.length - 1;

  return (
    <Screen>
      <View style={[styles.skipRow, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleFinish} accessibilityRole="button" accessibilityLabel={t('onboarding.skip')} hitSlop={8}>
          <Text variant="captionStrong" color="tertiary">
            {t('onboarding.skip')}
          </Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(item) => item.titleKey}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
        renderItem={({ item }) => (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(280)}
            style={[styles.page, { width: SCREEN_WIDTH }]}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.accentSoft }]}>
              <Ionicons name={item.icon} size={40} color={theme.colors.accent} />
            </View>
            <Text variant="display" style={styles.pageTitle}>
              {t(item.titleKey)}
            </Text>
            <Text variant="body" color="secondary" style={styles.pageBody}>
              {t(item.bodyKey)}
            </Text>
          </Animated.View>
        )}
      />

      <View style={styles.dotsRow}>
        {pages.map((page, index) => (
          <View
            key={page.titleKey}
            style={[
              styles.dot,
              {
                backgroundColor: index === pageIndex ? theme.colors.accent : theme.colors.border,
                width: index === pageIndex ? 20 : 6,
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Button label={isLastPage ? t('onboarding.startExploring') : t('onboarding.continueAction')} onPress={goToNext} />
        {isLastPage && (
          <Pressable onPress={handleSignIn} accessibilityRole="button" style={styles.signInRow} hitSlop={8}>
            <Text variant="captionStrong" color="accent">
              {t('onboarding.signIn')}
            </Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipRow: { alignItems: 'flex-end', paddingHorizontal: 20, minHeight: 32 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  pageTitle: { textAlign: 'center' },
  pageBody: { textAlign: 'center', marginTop: 12, lineHeight: 22, maxWidth: 320 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 8 },
  dot: { height: 6, borderRadius: 3 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 4 },
  signInRow: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
});
