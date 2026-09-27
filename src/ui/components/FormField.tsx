import React from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { SectionLabel } from './SectionLabel';

export interface FormFieldProps extends TextInputProps {
  label: string;
}

export function FormField({ label, style, ...rest }: FormFieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <SectionLabel>{label}</SectionLabel>
      <TextInput
        placeholderTextColor={theme.colors.textTertiary}
        style={[
          styles.input,
          { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 46 },
});
