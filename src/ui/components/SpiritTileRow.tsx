import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { DiscoveryCollection } from '../../domain/discovery';
import { SearchSpiritId } from '../../domain/searchSpirits';
import { useTranslation } from '../../i18n/useTranslation';
import { SectionHeader } from './SectionHeader';
import { SpiritTile } from './SpiritTile';

export interface SpiritTileRowProps {
  title: string;
  collections: DiscoveryCollection[];
}

export function SpiritTileRow({ title, collections }: SpiritTileRowProps) {
  const router = useRouter();
  const { tVocab } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <SectionHeader title={title} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {collections.map((collection) => {
          const spiritId = collection.id.replace('spirit-', '') as SearchSpiritId;
          return (
            <SpiritTile
              key={collection.id}
              spiritId={spiritId}
              label={tVocab(`searchSpirit.${spiritId}` as never)}
              onPress={() => router.push({ pathname: '/collection/[id]', params: { id: collection.id } })}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  headerWrap: { paddingHorizontal: 20 },
  row: { gap: 10, paddingHorizontal: 20 },
});
