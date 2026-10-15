import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  label: string;
  title: string;
  subtitle: string;
  onBack: () => void;
  progress?: { current: number; total: number };
};

export default function OnboardingHeader({ label, title, subtitle, onBack, progress }: Props) {
  return (
    <View style={s.container}>
      <TouchableOpacity style={s.back} onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={s.backArrow}>←</Text>
      </TouchableOpacity>
      <Text style={s.label}>{label}</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>
      {progress && (
        <View style={s.progressRow}>
          <View style={s.progressDashes}>
            {Array.from({ length: progress.total }).map((_, i) => (
              <View key={i} style={[s.dash, i < progress.current ? s.dashFilled : s.dashEmpty]} />
            ))}
          </View>
          <Text style={s.progressCount}>{progress.current}/{progress.total}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 23, paddingTop: 61 },
  back: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(51,51,51,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 30,
  },
  backArrow: { fontSize: 16, color: '#333', lineHeight: 20 },
  label: {
    fontSize: 13, color: 'rgba(51,51,51,0.5)',
    letterSpacing: 0.42, textTransform: 'uppercase', marginBottom: 10,
  },
  title: { fontSize: 24, color: '#333', lineHeight: 30, fontWeight: '600', marginBottom: 5 },
  subtitle: { fontSize: 13, color: '#333', lineHeight: 20 },
  progressRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 20,
  },
  progressDashes: { flexDirection: 'row', gap: 10 },
  dash: { width: 29, height: 2, borderRadius: 1 },
  dashFilled: { backgroundColor: '#333' },
  dashEmpty: { backgroundColor: 'rgba(51,51,51,0.15)' },
  progressCount: { fontSize: 10, color: '#333', fontWeight: '600' },
});
