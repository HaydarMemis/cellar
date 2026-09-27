import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { DiscoveryCollection } from '../../domain/discovery';
import { getCollectionShortLabel } from '../../i18n/collectionLabels';
import { useTranslation } from '../../i18n/useTranslation';
import { Chip } from './Chip';
import { SectionHeader } from './SectionHeader';

export interface CollectionChipRowProps {
  title: string;
  collections: DiscoveryCollection[];
}

/** A titled row of chips that each open a Collection screen — used for "Browse by spirit/style/taste" on Search. */
export function CollectionChipRow({ title, collections }: CollectionChipRowProps) {
  const router = useRouter();
  const { tVocab } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <SectionHeader title={title} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {collections.map((collection) => (
          <Chip
            key={collection.id}
            label={getCollectionShortLabel(collection, tVocab)}
            onPress={() => router.push({ pathname: '/collection/[id]', params: { id: collection.id } })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  headerWrap: { paddingHorizontal: 20 },
  row: { gap: 8, paddingHorizontal: 20 },
});
