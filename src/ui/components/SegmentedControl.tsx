import React, { useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme/useTheme';
import { Text } from './Text';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

interface Layout {
  x: number;
  width: number;
}

/** A segmented control with a sliding background pill instead of an abrupt color swap between options. */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const theme = useTheme();
  const layoutsRef = useRef<Record<string, Layout>>({});
  const [, forceRender] = useState(0);
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const hasMeasured = useRef(false);

  const applyPillPosition = (id: string, animate: boolean) => {
    const layout = layoutsRef.current[id];
    if (!layout) return;
    if (animate) {
      pillX.value = withTiming(layout.x, { duration: 200 });
      pillWidth.value = withTiming(layout.width, { duration: 200 });
    } else {
      pillX.value = layout.x;
      pillWidth.value = layout.width;
    }
  };

  const handleLayout = (id: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layoutsRef.current[id] = { x, width };
    if (id === value && !hasMeasured.current) {
      hasMeasured.current = true;
      applyPillPosition(id, false);
      forceRender((n) => n + 1);
    }
  };

  React.useEffect(() => {
    applyPillPosition(value, hasMeasured.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillWidth.value,
  }));

  return (
    <View style={[styles.control, { backgroundColor: theme.colors.surfaceAlt }]}>
      <Animated.View style={[styles.pill, { backgroundColor: theme.colors.surface }, pillStyle]} />
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onLayout={handleLayout(opt.id)}
            onPress={() => onChange(opt.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={styles.segment}
          >
            <Text variant="captionStrong" color={active ? 'primary' : 'secondary'} numberOfLines={1} adjustsFontSizeToFit>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  control: { flexDirection: 'row', borderRadius: 12, padding: 4, position: 'relative' },
  pill: { position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: 9 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
