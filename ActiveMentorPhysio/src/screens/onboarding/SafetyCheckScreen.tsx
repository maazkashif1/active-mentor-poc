import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import OnboardingHeader from '../../components/OnboardingHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../config/api';

type Props = NativeStackScreenProps<any, any>;

const QUESTIONS = [
  'Are you currently experiencing fever along with your symptoms?',
  'Does your pain regularly wake you at night or remain severe while resting?',
  'Have you experienced unexplained weight loss?',
];

export default function SafetyCheckScreen({ navigation, route }: Props) {
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
    try {
      const stored = await AsyncStorage.getItem('userProfile');
      const profile = stored ? JSON.parse(stored) : {};
      const { area, side, returnTo } = (route.params ?? {}) as any;
      const updated = { ...profile, careArea: area, side, onboardingAnswers: safetyAnswers };
      await AsyncStorage.setItem('userProfile', JSON.stringify(updated));
      await api.patch('/users/profile', {
        firstName: updated.firstName,
        dob: updated.dob,
        city: updated.city,
        careArea: area,
        side,
        onboardingAnswers: safetyAnswers,
      });
      navigation.replace(returnTo || 'NewHome');
    } catch {
      navigation.replace((route.params as any)?.returnTo || 'NewHome');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <OnboardingHeader
          label="Now, your Safety"
          title="Tell us a little about your condition"
          subtitle="A few quick details will help your physiotherapist understand where you're starting from."
          onBack={() => step > 0 ? setStep(step - 1) : navigation.goBack()}
          progress={{ current: step + 1, total: QUESTIONS.length }}
        />

        <View style={s.body}>
          {/* Safety info card */}
          <View style={s.safetyCard}>
            <View style={s.cardIcon}>
              <Text style={s.cardIconText}>🛡️</Text>
            </View>
            <View style={s.cardText}>
              <Text style={s.cardTitle}>A quick safety check</Text>
              <Text style={s.cardBody}>
                Your answers help your care team know if you need medical attention before physiotherapy.
              </Text>
            </View>
          </View>

          {/* Warning banner (shown when user answers Yes) */}
          {showWarning && (
            <View style={s.warningCard}>
              <TouchableOpacity style={s.warningClose} onPress={dismissWarning}>
                <Text style={s.warningCloseText}>✕</Text>
              </TouchableOpacity>
              <Text style={s.warningTitle}>Please consult a doctor first</Text>
              <Text style={s.warningBody}>
                Based on your answer, we recommend consulting a medical professional before starting physiotherapy.
              </Text>
            </View>
          )}

          {!showWarning && (
            <>
              {/* Question */}
              <View style={s.qSection}>
                <View style={s.qNum}><Text style={s.qNumText}>{step + 1}</Text></View>
                <Text style={s.qText}>{QUESTIONS[step]}</Text>
              </View>

              {/* Yes / No */}
              <View style={s.answerRow}>
                <TouchableOpacity style={s.answerBtn} onPress={() => answer('Yes')}>
                  <Text style={s.answerBtnText}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.answerBtn, s.answerBtnActive]} onPress={() => answer('No')}>
                  <Text style={[s.answerBtnText, s.answerBtnTextActive]}>No</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {showWarning && (
            <TouchableOpacity style={s.btn} onPress={dismissWarning}>
              <Text style={s.btnText}>Continue Anyway</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={s.footer}>
          This check does not replace medical advice. If you feel very unwell, seek urgent medical care.
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 40 },
  body: { paddingHorizontal: 23, marginTop: 30, gap: 30 },
  safetyCard: {
    backgroundColor: '#333', borderRadius: 15,
    flexDirection: 'row', padding: 15, gap: 15, alignItems: 'flex-start',
  },
  cardIcon: {
    width: 42, height: 42, borderRadius: 11,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  cardIconText: { fontSize: 20 },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, color: '#fff', fontWeight: '600' },
  cardBody: { fontSize: 13, color: '#fff', lineHeight: 18 },
  warningCard: {
    borderWidth: 1.5, borderColor: '#e8a000', borderRadius: 14,
    padding: 20, backgroundColor: '#fffbf0',
  },
  warningClose: { position: 'absolute', top: 14, right: 14 },
  warningCloseText: { fontSize: 14, color: '#333' },
  warningTitle: { fontSize: 15, color: '#333', fontWeight: '600', marginBottom: 8, marginRight: 24 },
  warningBody: { fontSize: 13, color: '#333', lineHeight: 18 },
  qSection: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  qNum: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  qNumText: { fontSize: 11, color: '#fff', fontWeight: '500' },
  qText: { flex: 1, fontSize: 13, color: '#333', fontWeight: '500', lineHeight: 22 },
  answerRow: { flexDirection: 'row', gap: 15 },
  answerBtn: {
    flex: 1, height: 47, borderRadius: 11,
    borderWidth: 1, borderColor: '#333',
    alignItems: 'center', justifyContent: 'center',
  },
  answerBtnActive: { backgroundColor: '#333' },
  answerBtnText: { fontSize: 15, color: '#333' },
  answerBtnTextActive: { color: '#fff' },
  btn: {
    backgroundColor: '#333', borderRadius: 17, height: 47,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#333', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 6,
  },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  footer: {
    fontSize: 12, color: '#333', textAlign: 'center',
    paddingHorizontal: 23, marginTop: 20, lineHeight: 18,
  },
});
