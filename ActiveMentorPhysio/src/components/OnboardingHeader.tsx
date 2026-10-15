import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  label: string;
  title: string;
  subtitle: string;
  onBack: () => void;
  progress?: { current: number; total: number };
};

const SW = Dimensions.get('window').width;
const SCALE = SW / 390;
const ACCENT = '#e0e7ef';
const INK = '#333333';

const font = (weight: 'Light' | 'Regular' | 'Medium' | 'SemiBold' | 'Bold') =>
  Platform.select({
    ios: `Poppins-${weight}`,
    android: `Poppins-${weight}`,
    default: undefined,
  });

export default function OnboardingHeader({ label, title, subtitle, onBack, progress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.container, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
      <TouchableOpacity style={s.back} onPress={onBack} activeOpacity={0.85}>
        <Image
          source={require('../assets/images/figma/profile/icon_back.png')}
          style={s.backIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>
      <Text style={s.label}>{label}</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>
      {progress ? (
        <View style={s.progressRow}>
          <View style={s.progressTrack}>
            {Array.from({ length: progress.total }).map((_, i) => (
              <View
                key={i}
                style={[s.dash, i < progress.current ? s.dashFilled : s.dashEmpty]}
              />
            ))}
          </View>
          <Text style={s.progressCount}>
            {String(progress.current).padStart(2, '0')} / {String(progress.total).padStart(2, '0')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 24 * SCALE,
    paddingBottom: 4 * SCALE,
  },
  back: {
    width: 40 * SCALE,
    height: 40 * SCALE,
    borderRadius: 20 * SCALE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20 * SCALE,
  },
  backIcon: { width: 18 * SCALE, height: 18 * SCALE },
  label: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8 * SCALE,
  },
  title: {
    fontFamily: font('Medium'),
    fontSize: 26 * SCALE,
    fontWeight: '500',
    color: INK,
    lineHeight: 32 * SCALE,
    marginBottom: 8 * SCALE,
  },
  subtitle: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 21 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22 * SCALE,
  },
  progressTrack: { flexDirection: 'row', gap: 8 * SCALE, flex: 1, marginRight: 16 * SCALE },
  dash: { flex: 1, height: 3, borderRadius: 2 },
  dashFilled: { backgroundColor: INK },
  dashEmpty: { backgroundColor: ACCENT },
  progressCount: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
  },
});
