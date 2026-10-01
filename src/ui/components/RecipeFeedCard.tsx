import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PersonalRecipe, UserProfile } from '../../domain/types';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../theme/useTheme';
import { Avatar } from './Avatar';
import { FavoriteButton } from './FavoriteButton';
import { RecipeMedia } from './RecipeMedia';
import { Text } from './Text';

export interface RecipeFeedCardProps {
  recipe: PersonalRecipe;
  author: UserProfile | undefined;
  likeCount: number;
  isLiked: boolean;
  onToggleLike: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPress: () => void;
  onOpenCreator: () => void;
  onReport: () => void;
  width?: number;
}

const CARD_WIDTH = 216;
const MEDIA_HEIGHT = 288;

/**
 * A published (public) recipe as it appears in the Discover feed. A tall,
 * portrait-ish content card (not a square thumbnail) — enough vertical area
 * for real cocktail imagery/video to breathe, with creator identity and
 * engagement overlaid on the media the way a content feed reads, rather
 * than a small square catalog tile with text underneath.
 */
export function RecipeFeedCard({
  recipe,
  author,
  likeCount,
  isLiked,
  onToggleLike,
  isFavorite,
  onToggleFavorite,
  onPress,
  onOpenCreator,
  onReport,
  width = CARD_WIDTH,
}: RecipeFeedCardProps) {
  const theme = useTheme();
  const { t, tIngredient } = useTranslation();

  const ingredientPreview = recipe.ingredients
    .slice(0, 3)
    .map((ri) => tIngredient(ri.ingredientId))
    .join(' · ');

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={recipe.name} style={[styles.card, { width }]}>
      <View style={[styles.mediaWrap, { height: MEDIA_HEIGHT, borderRadius: theme.radii.lg }]}>
        <RecipeMedia recipe={recipe} height={MEDIA_HEIGHT} borderRadius={theme.radii.lg} />

        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={styles.scrim} pointerEvents="none" />

        <View style={styles.topRow}>
          <Pressable onPress={onOpenCreator} accessibilityRole="button" style={styles.creatorChip} hitSlop={4}>
            <Avatar seed={author?.id ?? recipe.ownerId} label={author?.displayName ?? '?'} size={22} uri={author?.avatarUrl} />
            <Text variant="caption" style={styles.creatorName} numberOfLines={1}>
              {author?.displayName ?? ''}
            </Text>
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable
              onPress={onReport}
              accessibilityRole="button"
              accessibilityLabel={t('moderation.reportRecipe')}
              style={styles.overflowButton}
              hitSlop={6}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color="#FFFFFF" />
            </Pressable>
            <View style={styles.favoriteWrap}>
              <FavoriteButton isFavorite={isFavorite} onToggle={onToggleFavorite} onLightSurface={false} size={18} />
            </View>
          </View>
        </View>

        <View style={styles.bottomOverlay}>
          <Text style={styles.name} numberOfLines={1}>
            {recipe.name}
          </Text>
          {recipe.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {recipe.description}
            </Text>
          ) : null}
          {ingredientPreview ? (
            <Text style={styles.ingredients} numberOfLines={1}>
              {ingredientPreview}
            </Text>
          ) : null}
          <Pressable
            onPress={onToggleLike}
            accessibilityRole="button"
            accessibilityLabel={isLiked ? t('discover.unlikeAction') : t('discover.likeAction')}
            style={styles.likeRow}
            hitSlop={6}
          >
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={15} color={isLiked ? '#FF6B6B' : '#FFFFFF'} />
            <Text style={styles.likeCount}>{t('discover.likesCount', { count: likeCount })}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 0 },
  mediaWrap: { position: 'relative', overflow: 'hidden' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%' },
  topRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 999,
    paddingVertical: 3,
    paddingRight: 10,
    paddingLeft: 3,
    maxWidth: '68%',
  },
  creatorName: { color: '#FFFFFF', fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overflowButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomOverlay: { position: 'absolute', left: 12, right: 12, bottom: 10, gap: 2 },
  name: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  description: { color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 16, marginTop: 2 },
  ingredients: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 3 },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, minHeight: 22 },
  likeCount: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
