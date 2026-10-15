import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
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

const SURGERY_OPTS = ['Yes', 'No', 'Not sure'];
const ONSET_OPTS = [
  'Less than 1 week',
  '1–4 weeks',
  '1–3 months',
  '3+ months',
  'Not sure',
];
const PAIN_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function KneeIntakeScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { area = 'Knee', side = '', returnTo, fromBooking } = (route.params as any) ?? {};
  const [surgery, setSurgery] = useState('');
  const [onset, setOnset] = useState('');
  const [pain, setPain] = useState(0);

  const canContinue = !!(surgery && onset && pain > 0);
  const areaLower = String(area).toLowerCase();

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label={fromBooking ? 'Before we confirm' : 'Your care'}
          title={`A little about your ${areaLower}`}
          subtitle={
            fromBooking
              ? 'Shared with your physiotherapist for this appointment.'
              : 'A few details so care starts from where you are.'
          }
          onBack={() => navigation.goBack()}
          progress={{ current: 2, total: 3 }}
        />

        <View style={s.body}>
          <Question
            n={1}
            title={`Have you had surgery on this ${areaLower}?`}
          >
            <View style={s.optRow}>
              {SURGERY_OPTS.map(o => (
                <Chip key={o} label={o} on={surgery === o} onPress={() => setSurgery(o)} />
              ))}
            </View>
          </Question>

          <Question n={2} title="When did the problem begin?">
            <View style={s.optRow}>
              {ONSET_OPTS.map(o => (
                <Chip key={o} label={o} on={onset === o} onPress={() => setOnset(o)} />
              ))}
            </View>
          </Question>

          <Question
            n={3}
            title="How much pain are you feeling right now?"
            hint="1 is mild · 10 is severe"
          >
            <View style={s.painScale}>
              <View style={s.painRow}>
                {PAIN_LEVELS.map(n => {
                  const on = pain === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[s.painBtn, on && s.painBtnOn]}
                      onPress={() => setPain(n)}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.painText, on && s.painTextOn]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {pain > 0 ? (
                <Text style={s.painEcho}>
                  You selected <Text style={s.painEchoStrong}>{pain}/10</Text>
                </Text>
              ) : null}
            </View>
          </Question>
        </View>

        <TouchableOpacity
          style={[s.cta, !canContinue && s.ctaDisabled]}
          onPress={() =>
            navigation.navigate('SafetyCheck', {
              area,
              side,
              surgery,
              onset,
              pain,
              returnTo,
              fromBooking,
            })
          }
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={s.ctaText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Question({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.qCard}>
      <View style={s.qHead}>
        <View style={s.qNum}>
          <Text style={s.qNumText}>{n}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.qTitle}>{title}</Text>
          {hint ? <Text style={s.qHint}>{hint}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.chip, on && s.chipOn]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scrollContent: {},
  body: {
    paddingHorizontal: H_PAD,
    marginTop: 24 * SCALE,
    gap: 14 * SCALE,
  },
  qCard: {
    backgroundColor: '#f7f8fb',
    borderRadius: 18,
    padding: 16 * SCALE,
    gap: 14 * SCALE,
  },
  qHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 * SCALE },
  qNum: {
    width: 28 * SCALE,
    height: 28 * SCALE,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qNumText: {
    fontFamily: font('Medium'),
    fontSize: 12 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  qTitle: {
    fontFamily: font('Medium'),
    fontSize: 14 * SCALE,
    fontWeight: '500',
    color: INK,
    lineHeight: 20 * SCALE,
  },
  qHint: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.45)',
    marginTop: 4 * SCALE,
  },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 * SCALE },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 14 * SCALE,
    paddingVertical: 11 * SCALE,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: ACCENT },
  chipText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: 'rgba(51,51,51,0.6)',
  },
  chipTextOn: {
    fontFamily: font('Medium'),
    fontWeight: '500',
    color: INK,
  },
  painScale: { gap: 10 * SCALE },
  painRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6 * SCALE,
  },
  painBtn: {
    width: 30 * SCALE,
    height: 36 * SCALE,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  painBtnOn: { backgroundColor: ACCENT },
  painText: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },
  painTextOn: {
    fontFamily: font('Medium'),
    fontWeight: '500',
    color: INK,
  },
  painEcho: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
  painEchoStrong: {
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
});
