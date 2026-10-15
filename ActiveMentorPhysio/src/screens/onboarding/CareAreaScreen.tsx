import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ImageBackground,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import OnboardingHeader from '../../components/OnboardingHeader';

type Props = NativeStackScreenProps<any, any>;

const SW = Dimensions.get('window').width;
const SCALE = SW / 390;
const H_PAD = 24 * SCALE;
const ACCENT = '#e0e7ef';
const INK = '#333333';

const font = (weight: 'Light' | 'Regular' | 'Medium' | 'SemiBold' | 'Bold') =>
  Platform.select({
    ios: `Poppins-${weight}`,
    android: `Poppins-${weight}`,
    default: undefined,
  });

const AREAS = ['Knee', 'Shoulder', 'Elbow', 'Joints'] as const;
const SIDES = ['Left', 'Right', 'Both'];
const BILATERAL = new Set(['Knee', 'Shoulder', 'Elbow']);

const AREA_IMAGES: Record<string, any> = {
  Knee: require('../../assets/images/figma/care_knee.png'),
  Shoulder: require('../../assets/images/figma/care_shoulder.png'),
  Elbow: require('../../assets/images/figma/care_elbow.png'),
  Joints: require('../../assets/images/figma/care_mobility.png'),
};

const AREA_COPY: Record<string, { title: string; sub: string; sideQ: string }> = {
  Knee: {
    title: 'Knee care',
    sub: 'Strength, stability, and guided recovery',
    sideQ: 'Which knee?',
  },
  Shoulder: {
    title: 'Shoulder care',
    sub: 'Mobility and rehab for everyday reach',
    sideQ: 'Which shoulder?',
  },
  Elbow: {
    title: 'Elbow care',
    sub: 'Ease pain and restore range',
    sideQ: 'Which elbow?',
  },
  Joints: {
    title: 'Joint mobility',
    sub: 'Gentle movement across the body',
    sideQ: 'Which side?',
  },
};

export default function CareAreaScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState<(typeof AREAS)[number]>('Knee');
  const [side, setSide] = useState('');
  const returnTo = (route.params as any)?.returnTo;
  const fromBooking = !!(route.params as any)?.fromBooking;

  const needsSide = BILATERAL.has(area);
  const canContinue = !needsSide || side !== '';
  const copy = AREA_COPY[area];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label={fromBooking ? 'Before we confirm' : 'Your care'}
          title={fromBooking ? 'What brings you in today?' : 'Where does it need help?'}
          subtitle={
            fromBooking
              ? 'A short form so your physiotherapist knows what to focus on this visit.'
              : "Pick an area — we'll keep the next questions quick."
          }
          onBack={() => navigation.goBack()}
          progress={{ current: 1, total: 3 }}
        />

        <View style={s.chipRow}>
          {AREAS.map(a => {
            const on = area === a;
            return (
              <TouchableOpacity
                key={a}
                style={[s.chip, on && s.chipOn]}
                onPress={() => {
                  setArea(a);
                  setSide('');
                }}
                activeOpacity={0.85}
              >
                <Text style={[s.chipText, on && s.chipTextOn]}>{a}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.heroCard}>
          <ImageBackground
            source={AREA_IMAGES[area]}
            style={s.heroImg}
            resizeMode="cover"
            imageStyle={s.heroRadius}
          >
            <View style={s.heroDim} />
            <View style={s.heroCopy}>
              <Text style={s.heroTitle}>{copy.title}</Text>
              <Text style={s.heroSub}>{copy.sub}</Text>
            </View>

            {needsSide ? (
              <View style={s.sideBlock}>
                <Text style={s.sideQ}>{copy.sideQ}</Text>
                <View style={s.sideRow}>
                  {SIDES.map(sv => {
                    const on = side === sv;
                    return (
                      <TouchableOpacity
                        key={sv}
                        style={[s.sideBtn, on && s.sideBtnOn]}
                        onPress={() => setSide(sv)}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.sideText, on && s.sideTextOn]}>{sv}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </ImageBackground>
        </View>

        <TouchableOpacity
          style={[s.cta, !canContinue && s.ctaDisabled]}
          onPress={() =>
            navigation.navigate('KneeIntake', {
              area,
              side: needsSide ? side : '',
              returnTo,
              fromBooking,
            })
          }
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={s.ctaText}>Continue</Text>
        </TouchableOpacity>

        <Text style={s.footer}>More care areas coming soon</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scrollContent: {},
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8 * SCALE,
    paddingHorizontal: H_PAD,
    marginTop: 28 * SCALE,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 16 * SCALE,
    paddingVertical: 10 * SCALE,
    backgroundColor: '#f3f5f8',
  },
  chipOn: { backgroundColor: ACCENT },
  chipText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },
  chipTextOn: {
    fontFamily: font('Medium'),
    fontWeight: '500',
    color: INK,
  },
  heroCard: {
    marginHorizontal: H_PAD,
    marginTop: 20 * SCALE,
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroImg: {
    height: 360 * SCALE,
    justifyContent: 'flex-end',
  },
  heroRadius: { borderRadius: 20 },
  heroDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  heroCopy: {
    paddingHorizontal: 20 * SCALE,
    paddingBottom: 18 * SCALE,
    gap: 4 * SCALE,
  },
  heroTitle: {
    fontFamily: font('Medium'),
    fontSize: 20 * SCALE,
    fontWeight: '500',
    color: '#fff',
  },
  heroSub: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(255,255,255,0.85)',
  },
  sideBlock: {
    paddingHorizontal: 16 * SCALE,
    paddingBottom: 16 * SCALE,
    gap: 10 * SCALE,
  },
  sideQ: {
    fontFamily: font('Medium'),
    fontSize: 12 * SCALE,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.3,
  },
  sideRow: { flexDirection: 'row', gap: 8 * SCALE },
  sideBtn: {
    flex: 1,
    height: 44 * SCALE,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnOn: { backgroundColor: '#fff' },
  sideText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: '#fff',
  },
  sideTextOn: {
    fontFamily: font('Medium'),
    fontWeight: '500',
    color: INK,
  },
  cta: {
    marginHorizontal: H_PAD,
    marginTop: 24 * SCALE,
    height: 50 * SCALE,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: {
    fontFamily: font('Medium'),
    fontSize: 15 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  footer: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.4)',
    textAlign: 'center',
    marginTop: 16 * SCALE,
  },
});
