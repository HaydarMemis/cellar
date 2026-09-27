import React from 'react';
import { PersonalRecipe } from '../../domain/types';
import { DrinkVisual } from './DrinkVisual';

export interface RecipeMediaProps {
  recipe: PersonalRecipe;
  height: number;
  borderRadius?: number;
}

/**
 * The Discover feed's media surface for a published recipe. This is the one
 * integration point for short looping recipe videos (see
 * PersonalRecipe.videoUri) — no upload flow produces a video today, so this
 * always falls through to the existing photo/abstract-visual rendering
 * (DrinkVisual). Wiring a real player is one addition here: install
 * `expo-video`, and when `recipe.videoUri` is set, render a muted, looping,
 * autoplay-when-visible `<VideoView>` instead of falling through below —
 * every caller of RecipeMedia already renders through this single
 * component, so no card/screen needs to change when that lands.
 */
export function RecipeMedia({ recipe, height, borderRadius = 0 }: RecipeMediaProps) {
  return <DrinkVisual source={{ kind: 'recipe', item: recipe }} height={height} borderRadius={borderRadius} />;
}
