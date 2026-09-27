import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NewRecipeInput } from '../src/data/repositories/RecipeRepository';
import { canCreateAnotherRecipe, FREE_RECIPE_LIMIT } from '../src/domain/entitlements';
import { difficultyOptionIds, tasteOptionIds, typeOptionIds } from '../src/domain/filterOptions';
import { deleteManagedLocalPhoto, isManagedLocalPhoto, prepareRecipePhoto, resolveLocalPhotoUri } from '../src/data/localMedia';
import { SyncErrorField, SyncErrorReason } from '../src/data/syncErrors';
import { generateId } from '../src/domain/id';
import { parseDecimal } from '../src/domain/parseDecimal';
import { Difficulty, GlassType, LOCAL_GUEST_OWNER_ID, PreparationMethod, RecipeIngredient, Unit, Visibility } from '../src/domain/types';
import { UiKey, useTranslation } from '../src/i18n/useTranslation';
import { Chip } from '../src/ui/components/Chip';
import { FormField } from '../src/ui/components/FormField';
import { IngredientPickerModal } from '../src/ui/components/IngredientPickerModal';
import { Screen } from '../src/ui/components/Screen';
import { SectionLabel } from '../src/ui/components/SectionLabel';
import { SegmentedControl } from '../src/ui/components/SegmentedControl';
import { Text } from '../src/ui/components/Text';
import { useAuthStore } from '../src/state/authStore';
import { useEntitlementStore } from '../src/state/entitlementStore';
import { RecipePublishError, useRecipesStore } from '../src/state/recipesStore';
import { useTheme } from '../src/theme/useTheme';

interface IngredientDraft {
  key: string;
  ingredientId: string | null;
  amountValue: string;
  unit: Unit;
  note: string;
  isOptional: boolean;
}

const methodIds: PreparationMethod[] = ['shake', 'stir', 'build', 'blend', 'muddle', 'layer'];
const units: Unit[] = ['ml', 'oz', 'cl', 'dash', 'tsp', 'barspoon', 'piece', 'leaf', 'rinse'];
const glassTypeIds: GlassType[] = [
  'rocks',
  'coupe',
  'martini',
  'collins',
  'highball',
  'copper-mug',
  'julep-cup',
  'hurricane',
  'flute',
  'wine-glass',
  'irish-coffee-glass',
  'pint-glass',
  'tiki-mug',
  'nick-and-nora',
  'snifter',
  'shot',
  'mug',
  'other',
];

/** Mirrors the database constraints on public.recipes (migrations 20260922000100 / 20260926120000), so a recipe that saves locally can also be published. */
const RECIPE_LIMITS = { name: 120, description: 2000, garnish: 200, notes: 2000, stepLength: 500, steps: 30, ingredients: 40 } as const;

/** "the photo is too large (photo)" — the human-readable half of "Couldn't publish: …". */
function describeSyncError(t: (key: UiKey, options?: Record<string, string | number>) => string, reason: SyncErrorReason | string | undefined, field?: SyncErrorField | string): string {
  const knownReasons: SyncErrorReason[] = ['photoMissing', 'photoUnsupported', 'photoTooLarge', 'photoRejected', 'invalidRecipe', 'notAllowed', 'rejected'];
  const reasonText = t(`publish.syncErrorReason.${knownReasons.includes(reason as SyncErrorReason) ? (reason as SyncErrorReason) : 'rejected'}`);
  const knownFields: SyncErrorField[] = ['name', 'description', 'method', 'glass', 'steps', 'tags', 'category', 'ingredients', 'garnish', 'abv', 'prepTime', 'difficulty', 'baseSpirit', 'photo', 'video'];
  // Photo reasons already name the photo; don't repeat it.
  if (!field || !knownFields.includes(field as SyncErrorField) || (field === 'photo' && reason !== 'invalidRecipe')) return reasonText;
  return t('publish.syncErrorReasonWithField', { reason: reasonText, field: t(`publish.syncErrorField.${field as SyncErrorField}`) });
}

function emptyIngredient(): IngredientDraft {
  return { key: generateId('draft'), ingredientId: null, amountValue: '', unit: 'ml', note: '', isOptional: false };
}

export default function RecipeEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, tVocab, tIngredient } = useTranslation();
  const recipes = useRecipesStore((s) => s.recipes);
  const createRecipe = useRecipesStore((s) => s.create);
  const updateRecipe = useRecipesStore((s) => s.update);
  const authProfile = useAuthStore((s) => s.profile);
  const isPremium = useEntitlementStore((s) => s.isPremium);

  // Only a recipe this identity owns can be edited here (defense in depth —
  // the repository also refuses writes to another owner's recipe).
  const ownerId = useAuthStore((s) => s.profile?.id ?? LOCAL_GUEST_OWNER_ID);
  const existing = useMemo(() => recipes.find((r) => r.id === id && r.ownerId === ownerId), [id, recipes, ownerId]);
  const isEditing = !!existing;

  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? 'private');
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [baseSpirit, setBaseSpirit] = useState<string | null>(existing?.baseSpirit ?? null);
  const [category, setCategory] = useState<string[]>(existing?.category ?? []);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [method, setMethod] = useState<PreparationMethod | null>(existing?.method ?? null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(existing?.difficulty ?? null);
  const [glass, setGlass] = useState<GlassType | null>(existing?.glass?.[0] ?? null);
  const [garnish, setGarnish] = useState(existing?.garnish ?? '');
  const [prepTime, setPrepTime] = useState(existing ? String(existing.prepTimeMinutes) : '');
  const [abv, setAbv] = useState(existing?.abv ? String(existing.abv.approx) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [photoUri, setPhotoUri] = useState<string | undefined>(existing?.photoUri);
  const [steps, setSteps] = useState<string[]>(existing?.steps?.length ? existing.steps : ['']);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const savingRef = useRef(false);
  /**
   * Photos processed into documents/recipe-photos during THIS editing
   * session. Any of them that no saved recipe ends up using (re-picked,
   * removed, or the editor was left without saving) is deleted, so
   * abandoned picks don't pile up on disk. A recipe's already-saved photo
   * is never in here, so cancelling can't delete it.
   */
  const sessionPhotos = useRef(new Set<string>());

  const discardSessionPhoto = (uri: string | undefined) => {
    if (!uri || !sessionPhotos.current.has(uri)) return;
    if (useRecipesStore.getState().recipes.some((r) => r.photoUri === uri)) return;
    sessionPhotos.current.delete(uri);
    deleteManagedLocalPhoto(uri);
  };

  useEffect(() => {
    const picks = sessionPhotos.current;
    return () => {
      // Unmount (saved, cancelled, or swiped away): anything still unused goes.
      const inUse = new Set(useRecipesStore.getState().recipes.map((r) => r.photoUri));
      for (const uri of picks) if (!inUse.has(uri)) deleteManagedLocalPhoto(uri);
      picks.clear();
    };
  }, []);
  const [ingredientDrafts, setIngredientDrafts] = useState<IngredientDraft[]>(
    existing?.ingredients.length
      ? existing.ingredients.map((ri) => ({
          key: generateId('draft'),
          ingredientId: ri.ingredientId,
          amountValue: ri.amount ? String(ri.amount.value) : '',
          unit: ri.amount?.unit ?? 'ml',
          note: ri.note ?? '',
          isOptional: ri.isOptional,
        }))
      : [emptyIngredient()],
  );

  const [pickerFor, setPickerFor] = useState<'baseSpirit' | string | null>(null);

  const updateIngredient = (key: string, patch: Partial<IngredientDraft>) =>
    setIngredientDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const removeIngredient = (key: string) =>
    setIngredientDrafts((prev) => (prev.length > 1 ? prev.filter((d) => d.key !== key) : prev));

  const pickPhoto = async () => {
    // No permission prompt needed: the system photo picker (PHPicker on iOS,
    // the Android Photo Picker) runs out of process and only hands back the
    // photo the person chose.
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: true,
        aspect: [4, 3],
      });
    } catch {
      Alert.alert(t('recipeEditor.photoPermissionTitle'), t('recipeEditor.photoPermissionMessage'));
      return;
    }
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoBusy(true);
      try {
        const prepared = await prepareRecipePhoto({ uri: asset.uri, width: asset.width, height: asset.height });
        if (isManagedLocalPhoto(prepared)) sessionPhotos.current.add(prepared);
        discardSessionPhoto(photoUri); // the pick this one replaces, if it was never saved
        setPhotoUri(prepared);
      } catch {
        // Never fall back to the unprocessed original (full size, may carry
        // EXIF/GPS) — keep the previous photo and tell the user.
        Alert.alert(t('recipeEditor.photoProcessingFailedTitle'), t('recipeEditor.photoProcessingFailedMessage'));
      } finally {
        setPhotoBusy(false);
      }
    }
  };

  const removePhoto = () => {
    discardSessionPhoto(photoUri);
    setPhotoUri(undefined);
  };

  const canSave =
    !saving &&
    !photoBusy &&
    name.trim().length > 0 &&
    !!glass &&
    !!method &&
    !!difficulty &&
    !!baseSpirit &&
    ingredientDrafts.some((d) => d.ingredientId) &&
    steps.some((s) => s.trim().length > 0);

  const handleSave = async () => {
    if (!canSave || !method || !difficulty || !baseSpirit || !glass) return;
    // `saving` is React state, so two taps inside one frame both see
    // `false` — this ref closes that window (a double tap on Save would
    // otherwise create the recipe twice, and publish it twice).
    if (savingRef.current) return;

    if (visibility === 'public' && !authProfile) {
      Alert.alert(t('publish.signInRequiredTitle'), t('publish.signInRequiredMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('publish.signInAction'), onPress: () => router.push('/auth') },
      ]);
      return;
    }

    // Count only THIS identity's recipes — the store also holds other
    // accounts' device-local recipes (and the guest's), which must not use
    // up this account's free allowance.
    const ownRecipeCount = recipes.filter((r) => r.ownerId === ownerId).length;
    if (!isEditing && !canCreateAnotherRecipe(isPremium, ownRecipeCount)) {
      Alert.alert(t('publish.limitReachedTitle'), t('publish.limitReachedMessage', { limit: FREE_RECIPE_LIMIT }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('publish.upgradeAction'), onPress: () => router.push('/premium') },
      ]);
      return;
    }

    savingRef.current = true;
    setSaving(true);

    const ingredients: RecipeIngredient[] = ingredientDrafts
      .filter((d) => d.ingredientId)
      .map((d) => {
        const amountValue = parseDecimal(d.amountValue);
        return {
          ingredientId: d.ingredientId as string,
          amount: amountValue !== null ? { value: amountValue, unit: d.unit } : null,
          note: d.note.trim() || undefined,
          isOptional: d.isOptional,
          isGarnish: false,
        };
      });

    const abvValue = parseDecimal(abv);
    const prepTimeValue = parseDecimal(prepTime);

    const input: NewRecipeInput = {
      name: name.trim(),
      description: description.trim(),
      baseSpirit,
      category,
      tags,
      ingredients,
      method,
      steps: steps.map((s) => s.trim()).filter(Boolean),
      glass: [glass],
      garnish: garnish.trim() || undefined,
      abv: abvValue !== null ? { approx: Math.min(100, Math.max(0, abvValue)) } : null,
      difficulty,
      prepTimeMinutes: prepTimeValue !== null ? Math.min(240, Math.max(1, Math.round(prepTimeValue))) : 5,
      photoUri,
      notes: notes.trim() || undefined,
      visibility,
    };

    try {
      if (isEditing && existing) {
        await updateRecipe(existing.id, input);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        router.back();
      } else {
        const created = await createRecipe(input);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        router.replace({ pathname: '/cocktail/[id]', params: { id: created.id, type: 'recipe' } });
      }
    } catch (e) {
      // The recipe itself IS saved on this device (local-first — see
      // RecipePublishError); only the publish half failed. Say exactly
      // that rather than implying the whole save was lost.
      if (e instanceof RecipePublishError && e.permanent) {
        // The backend rejected it — no automatic retry will fix this, so
        // don't promise one. Stay in the editor so the author can fix it.
        Alert.alert(t('publish.syncRejectedTitle'), t('publish.syncRejectedMessage', { reason: describeSyncError(t, e.reason, e.field) }));
        // A new recipe now exists locally: reopen it in edit mode so the
        // next Save updates it (instead of creating a duplicate).
        if (!isEditing && e.recipeId) router.replace({ pathname: '/recipe-editor', params: { id: e.recipeId } });
      } else if (e instanceof RecipePublishError) {
        Alert.alert(t('publish.syncFailedTitle'), t('publish.syncFailedMessage'));
        router.back();
      } else {
        // The local save itself failed (storage error) — nothing was
        // written; keep the form so the user doesn't lose their input.
        Alert.alert(t('common.genericErrorTitle'), t('common.genericErrorMessage'));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('recipeEditor.cancel')} hitSlop={8}>
          <Text variant="body" color="secondary">
            {t('recipeEditor.cancel')}
          </Text>
        </Pressable>
        <Text variant="headline">{isEditing ? t('recipeEditor.titleEdit') : t('recipeEditor.titleNew')}</Text>
        <Pressable onPress={handleSave} disabled={!canSave} accessibilityRole="button" accessibilityLabel={t('recipeEditor.save')} hitSlop={8}>
          <Text variant="bodyStrong" color={canSave ? 'accent' : 'tertiary'}>
            {saving ? t('common.saving') : t('recipeEditor.save')}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {existing?.syncError ? (
          <View style={[styles.syncErrorBanner, { backgroundColor: theme.colors.surfaceAlt }]} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color={theme.colors.textSecondary} />
            <Text variant="caption" color="secondary" style={{ flex: 1 }}>
              {t('publish.syncRejectedBanner', { reason: describeSyncError(t, existing.syncError.reason, existing.syncError.field) })}
            </Text>
          </View>
        ) : null}
        <Pressable
          onPress={pickPhoto}
          accessibilityRole="button"
          accessibilityLabel={t('recipeEditor.addPhoto')}
          style={[styles.photoPicker, { backgroundColor: theme.colors.surfaceAlt }]}
        >
          {photoBusy ? (
            <View style={styles.photoPlaceholder}>
              <ActivityIndicator color={theme.colors.textSecondary} />
            </View>
          ) : photoUri ? (
            <Image source={{ uri: resolveLocalPhotoUri(photoUri) }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={26} color={theme.colors.textSecondary} />
              <Text variant="caption" color="secondary">
                {t('recipeEditor.addPhoto')}
              </Text>
            </View>
          )}
        </Pressable>
        {photoUri && !photoBusy ? (
          <View style={styles.photoActions}>
            <Pressable onPress={pickPhoto} accessibilityRole="button" hitSlop={8}>
              <Text variant="captionStrong" color="accent">
                {t('recipeEditor.changePhoto')}
              </Text>
            </Pressable>
            <Pressable onPress={removePhoto} accessibilityRole="button" hitSlop={8}>
              <Text variant="captionStrong" color="secondary">
                {t('recipeEditor.removePhoto')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <FormField label={t('recipeEditor.fieldName')} value={name} onChangeText={setName} placeholder={t('recipeEditor.fieldNamePlaceholder')} maxLength={RECIPE_LIMITS.name} />
        <FormField
          label={t('recipeEditor.fieldDescription')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('recipeEditor.fieldDescriptionPlaceholder')}
          maxLength={RECIPE_LIMITS.description}
          multiline
          style={{ minHeight: 70, textAlignVertical: 'top' }}
        />

        <View style={styles.field}>
          <SectionLabel>{t('publish.fieldVisibility')}</SectionLabel>
          <SegmentedControl
            options={[
              { id: 'private' as Visibility, label: t('publish.visibilityPrivate') },
              { id: 'public' as Visibility, label: t('publish.visibilityPublic') },
            ]}
            value={visibility}
            onChange={setVisibility}
          />
          <Text variant="caption" color="secondary">
            {visibility === 'public' ? t('publish.visibilityPublicHint') : t('publish.visibilityPrivateHint')}
          </Text>
        </View>

        <View style={styles.field}>
          <SectionLabel>{t('recipeEditor.fieldBaseSpirit')}</SectionLabel>
          <Pressable
            onPress={() => setPickerFor('baseSpirit')}
            style={[styles.selectField, { backgroundColor: theme.colors.surfaceAlt }]}
          >
            <Text variant="body" color={baseSpirit ? 'primary' : 'tertiary'}>
              {baseSpirit ? tIngredient(baseSpirit) : t('recipeEditor.chooseBaseSpirit')}
            </Text>
          </Pressable>
        </View>

        <ChipField
          label={t('recipeEditor.fieldType')}
          options={typeOptionIds.map((id) => ({ id, label: tVocab(`category.${id}`) }))}
          selected={category}
          onChange={setCategory}
        />
        <ChipField
          label={t('recipeEditor.fieldTaste')}
          options={tasteOptionIds.map((id) => ({ id, label: tVocab(`taste.${id}`) }))}
          selected={tags}
          onChange={setTags}
        />
        <SingleChipField
          label={t('recipeEditor.fieldMethod')}
          options={methodIds.map((id) => ({ id, label: tVocab(`method.${id}`) }))}
          selected={method}
          onChange={setMethod}
        />
        <SingleChipField
          label={t('recipeEditor.fieldDifficulty')}
          options={difficultyOptionIds.map((id) => ({ id, label: tVocab(`difficulty.${id}`) }))}
          selected={difficulty}
          onChange={setDifficulty}
        />
        <SingleChipField
          label={t('recipeEditor.fieldGlass')}
          options={glassTypeIds.map((id) => ({ id, label: tVocab(`glass.${id}`) }))}
          selected={glass}
          onChange={setGlass}
        />

        <View style={styles.field}>
          <SectionLabel>{t('recipeEditor.fieldIngredients')}</SectionLabel>
          <View style={{ gap: 10 }}>
            {ingredientDrafts.map((draft) => (
              <View key={draft.key} style={[styles.ingredientCard, { backgroundColor: theme.colors.surfaceAlt }]}>
                <View style={styles.ingredientTopRow}>
                  <Pressable style={{ flex: 1 }} onPress={() => setPickerFor(draft.key)}>
                    <Text variant="body" color={draft.ingredientId ? 'primary' : 'tertiary'}>
                      {draft.ingredientId ? tIngredient(draft.ingredientId) : t('recipeEditor.chooseIngredient')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => removeIngredient(draft.key)}
                    accessibilityRole="button"
                    accessibilityLabel={t('recipeEditor.removeIngredient')}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={theme.colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={styles.amountRow}>
                  <TextInput
                    value={draft.amountValue}
                    onChangeText={(v) => updateIngredient(draft.key, { amountValue: v })}
                    placeholder={t('recipeEditor.amountPlaceholder')}
                    keyboardType="decimal-pad"
                    maxLength={7}
                    placeholderTextColor={theme.colors.textTertiary}
                    style={[styles.amountInput, { color: theme.colors.textPrimary, backgroundColor: theme.colors.surface }]}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                    <View style={styles.unitRow}>
                      {units.map((u) => (
                        <Chip
                          key={u}
                          label={tVocab(`unit.${u}`)}
                          selected={draft.unit === u}
                          onPress={() => updateIngredient(draft.key, { unit: u })}
                        />
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <Pressable
                  onPress={() => updateIngredient(draft.key, { isOptional: !draft.isOptional })}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: draft.isOptional }}
                  style={styles.optionalRow}
                >
                  <Ionicons
                    name={draft.isOptional ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                  <Text variant="caption" color="secondary">
                    {t('recipeEditor.optionalIngredient')}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
          {ingredientDrafts.length < RECIPE_LIMITS.ingredients && (
          <Pressable onPress={() => setIngredientDrafts((prev) => [...prev, emptyIngredient()])} style={styles.addRow} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={18} color={theme.colors.accent} />
            <Text variant="captionStrong" color="accent">
              {t('recipeEditor.addIngredient')}
            </Text>
          </Pressable>
          )}
        </View>

        <View style={styles.field}>
          <SectionLabel>{t('recipeEditor.fieldSteps')}</SectionLabel>
          <View style={{ gap: 10 }}>
            {steps.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <Text variant="captionStrong" color="tertiary" style={styles.stepIndex}>
                  {index + 1}
                </Text>
                <TextInput
                  value={step}
                  onChangeText={(v) => setSteps((prev) => prev.map((s, i) => (i === index ? v : s)))}
                  placeholder={t('recipeEditor.stepPlaceholder')}
                  maxLength={RECIPE_LIMITS.stepLength}
                  placeholderTextColor={theme.colors.textTertiary}
                  style={[styles.stepInput, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary }]}
                  multiline
                />
                {steps.length > 1 && (
                  <Pressable
                    onPress={() => setSteps((prev) => prev.filter((_, i) => i !== index))}
                    accessibilityRole="button"
                    accessibilityLabel={t('recipeEditor.removeStep')}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={theme.colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
          {steps.length < RECIPE_LIMITS.steps && (
          <Pressable onPress={() => setSteps((prev) => [...prev, ''])} style={styles.addRow} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={18} color={theme.colors.accent} />
            <Text variant="captionStrong" color="accent">
              {t('recipeEditor.addStep')}
            </Text>
          </Pressable>
          )}
        </View>

        <FormField label={t('recipeEditor.fieldGarnish')} value={garnish} onChangeText={setGarnish} placeholder={t('recipeEditor.fieldGarnishPlaceholder')} maxLength={RECIPE_LIMITS.garnish} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <FormField
              label={t('recipeEditor.fieldPrepTime')}
              value={prepTime}
              onChangeText={setPrepTime}
              placeholder={t('recipeEditor.fieldPrepTimePlaceholder')}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label={t('recipeEditor.fieldAbv')}
              value={abv}
              onChangeText={setAbv}
              placeholder={t('recipeEditor.fieldAbvPlaceholder')}
              keyboardType="decimal-pad"
              maxLength={5}
            />
          </View>
        </View>

        <FormField
          label={t('recipeEditor.fieldNotes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('recipeEditor.fieldNotesPlaceholder')}
          maxLength={RECIPE_LIMITS.notes}
          multiline
          style={{ minHeight: 70, textAlignVertical: 'top' }}
        />
      </ScrollView>
      </KeyboardAvoidingView>

      <IngredientPickerModal
        visible={pickerFor === 'baseSpirit'}
        onClose={() => setPickerFor(null)}
        filterCategory="spirit"
        onSelect={(ing) => setBaseSpirit(ing.id)}
      />
      <IngredientPickerModal
        visible={pickerFor !== null && pickerFor !== 'baseSpirit'}
        onClose={() => setPickerFor(null)}
        onSelect={(ing) => {
          if (pickerFor && pickerFor !== 'baseSpirit') {
            updateIngredient(pickerFor, { ingredientId: ing.id });
          }
        }}
      />
    </Screen>
  );
}

function ChipField({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <View style={styles.field}>
      <SectionLabel>{label}</SectionLabel>
      <View style={styles.chipWrap}>
        {options.map((opt) => (
          <Chip
            key={opt.id}
            label={opt.label}
            selected={selected.includes(opt.id)}
            onPress={() =>
              onChange(selected.includes(opt.id) ? selected.filter((s) => s !== opt.id) : [...selected, opt.id])
            }
          />
        ))}
      </View>
    </View>
  );
}

function SingleChipField<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  selected: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <SectionLabel>{label}</SectionLabel>
      <View style={styles.chipWrap}>
        {options.map((opt) => (
          <Chip key={opt.id} label={opt.label} selected={selected === opt.id} onPress={() => onChange(opt.id)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  photoActions: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: -4 },
  syncErrorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  content: { paddingHorizontal: 20, paddingBottom: 60, gap: 20 },
  photoPicker: { height: 160, borderRadius: 16, overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  field: { gap: 8 },
  selectField: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, minHeight: 46, justifyContent: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ingredientCard: { borderRadius: 14, padding: 12, gap: 10 },
  ingredientTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  amountInput: { width: 80, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  unitRow: { flexDirection: 'row', gap: 6 },
  optionalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, minHeight: 32 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepIndex: { width: 16, marginTop: 14 },
  stepInput: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 44 },
  row: { flexDirection: 'row', gap: 12 },
});
