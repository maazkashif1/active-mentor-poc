import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import OnboardingHeader from '../../components/OnboardingHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../config/api';
import { bookSession } from '../../services/sessionService';

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

const QUESTIONS = [
  'Are you currently experiencing fever along with your symptoms?',
  'Does your pain regularly wake you at night or remain severe while resting?',
  'Have you experienced unexplained weight loss?',
];

export default function SafetyCheckScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const fromBooking = !!(route.params as any)?.fromBooking;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showWarning, setShowWarning] = useState(false);

  const answer = (val: string) => {
    const next = [...answers, val];
    setAnswers(next);

    if (val === 'Yes') {
      setShowWarning(true);
      return;
    }
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      completeOnboarding([...next]);
    }
  };

  const dismissWarning = () => {
    setShowWarning(false);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      completeOnboarding([...answers]);
    }
  };

  const completeOnboarding = async (safetyAnswers: string[]) => {
    const { area, side, surgery, onset, pain, returnTo } = (route.params ?? {}) as any;
    try {
      const stored = await AsyncStorage.getItem('userProfile');
      const profile = stored ? JSON.parse(stored) : {};
      const updated = {
        ...profile,
        careArea: area,
        side,
        surgery,
        onset,
        pain,
        onboardingAnswers: safetyAnswers,
      };
      await AsyncStorage.setItem('userProfile', JSON.stringify(updated));
      try {
        await api.patch('/users/profile', {
          firstName: updated.firstName,
          dob: updated.dob,
          city: updated.city,
          careArea: area,
          side,
          onboardingAnswers: safetyAnswers,
        });
      } catch {
        // profile sync is best-effort
      }

      const pendingRaw = await AsyncStorage.getItem('pendingBooking');
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          const visitNote = [
            pending.complaints || 'Appointment intake',
            `Area: ${area || '—'}${side ? ` (${side})` : ''}`,
            surgery != null && surgery !== '' ? `Surgery: ${surgery}` : null,
            onset ? `Onset: ${onset}` : null,
            pain ? `Pain: ${pain}/10` : null,
            `Safety: ${safetyAnswers.join(', ')}`,
          ]
            .filter(Boolean)
            .join('\n');
          await bookSession(pending.physioId, pending.date, pending.time, visitNote);
          await AsyncStorage.removeItem('pendingBooking');
          Alert.alert('Booked!', 'Your session has been scheduled.', [
            { text: 'OK', onPress: () => navigation.replace('ConsultHistory') },
          ]);
          return;
        } catch (e: any) {
          await AsyncStorage.removeItem('pendingBooking');
          Alert.alert(
            'Intake saved',
            e?.response?.data?.message ||
              'Could not complete booking. Please try again from the doctor profile.',
            [{ text: 'OK', onPress: () => navigation.replace(returnTo || 'NewHome') }],
          );
          return;
        }
      }

      navigation.replace(returnTo || 'NewHome');
    } catch {
      navigation.replace((route.params as any)?.returnTo || 'NewHome');
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label={fromBooking ? 'Before we confirm' : 'Safety'}
          title={fromBooking ? 'Quick safety check' : 'One more careful step'}
          subtitle={
            fromBooking
              ? 'Last step — then your appointment is booked.'
              : 'Helps your care team know if you need medical attention first.'
          }
          onBack={() => (step > 0 ? setStep(step - 1) : navigation.goBack())}
          progress={{ current: step + 1, total: QUESTIONS.length }}
        />

        <View style={s.body}>
          <View style={s.infoCard}>
            <Text style={s.infoEyebrow}>Why we ask</Text>
            <Text style={s.infoTitle}>A quick safety screen</Text>
            <Text style={s.infoBody}>
              Your answers help us spot red flags before physiotherapy begins.
            </Text>
          </View>

          {showWarning ? (
            <View style={s.warningCard}>
              <Text style={s.warningEyebrow}>Heads up</Text>
              <Text style={s.warningTitle}>Please consult a doctor first</Text>
              <Text style={s.warningBody}>
                Based on your answer, we recommend seeing a medical professional before starting
                physiotherapy.
              </Text>
              <TouchableOpacity style={s.cta} onPress={dismissWarning} activeOpacity={0.85}>
                <Text style={s.ctaText}>Continue anyway</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.qCard}>
              <View style={s.qHead}>
                <View style={s.qNum}>
                  <Text style={s.qNumText}>{step + 1}</Text>
                </View>
                <Text style={s.qText}>{QUESTIONS[step]}</Text>
              </View>

              <View style={s.answerRow}>
                <TouchableOpacity
                  style={s.answerBtn}
                  onPress={() => answer('Yes')}
                  activeOpacity={0.85}
                >
                  <Text style={s.answerBtnText}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.answerBtn, s.answerBtnPrimary]}
                  onPress={() => answer('No')}
                  activeOpacity={0.85}
                >
                  <Text style={[s.answerBtnText, s.answerBtnTextPrimary]}>No</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <Text style={s.footer}>
          This check does not replace medical advice. If you feel very unwell, seek urgent care.
        </Text>
      </ScrollView>
    </View>
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
  infoCard: {
    backgroundColor: ACCENT,
    borderRadius: 18,
    padding: 18 * SCALE,
    gap: 4 * SCALE,
  },
  infoEyebrow: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2 * SCALE,
  },
  infoTitle: {
    fontFamily: font('Medium'),
    fontSize: 16 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  infoBody: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    lineHeight: 19 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },
  qCard: {
    backgroundColor: '#f7f8fb',
    borderRadius: 18,
    padding: 18 * SCALE,
    gap: 20 * SCALE,
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
  qText: {
    flex: 1,
    fontFamily: font('Medium'),
    fontSize: 15 * SCALE,
    fontWeight: '500',
    color: INK,
    lineHeight: 22 * SCALE,
  },
  answerRow: { flexDirection: 'row', gap: 10 * SCALE },
  answerBtn: {
    flex: 1,
    height: 48 * SCALE,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerBtnPrimary: { backgroundColor: ACCENT },
  answerBtnText: {
    fontFamily: font('Light'),
    fontSize: 15 * SCALE,
    color: 'rgba(51,51,51,0.6)',
  },
  answerBtnTextPrimary: {
    fontFamily: font('Medium'),
    fontWeight: '500',
    color: INK,
  },
  warningCard: {
    backgroundColor: '#f7f8fb',
    borderRadius: 18,
    padding: 18 * SCALE,
    gap: 8 * SCALE,
  },
  warningEyebrow: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  warningTitle: {
    fontFamily: font('Medium'),
    fontSize: 17 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  warningBody: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    lineHeight: 20 * SCALE,
    color: 'rgba(51,51,51,0.55)',
    marginBottom: 8 * SCALE,
  },
  cta: {
    height: 48 * SCALE,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4 * SCALE,
  },
  ctaText: {
    fontFamily: font('Medium'),
    fontSize: 15 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  footer: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    lineHeight: 18 * SCALE,
    color: 'rgba(51,51,51,0.4)',
    textAlign: 'center',
    paddingHorizontal: H_PAD,
    marginTop: 24 * SCALE,
  },
});
