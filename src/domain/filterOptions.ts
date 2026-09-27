import { Difficulty } from './types';

/**
 * Ids only — labels are resolved from i18n vocab at the presentation layer
 * (see useTranslation().tVocab), so domain code carries no display text.
 */
export const tasteOptionIds = [
  'sweet',
  'sour',
  'bitter',
  'dry',
  'fruity',
  'herbal',
  'smoky',
  'spicy',
  'refreshing',
  'strong',
  'light',
] as const;

export const difficultyOptionIds: Difficulty[] = ['easy', 'medium', 'hard'];

export const typeOptionIds = [
  'classic',
  'tiki',
  'contemporary',
  'highball',
  'sour',
  'martini',
  'old-fashioned',
  'collins',
  'fizz',
  'punch',
  'spritz',
  'frozen',
  'alcohol-free',
] as const;
