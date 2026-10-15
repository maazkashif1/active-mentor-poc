import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import OnboardingHeader from '../../components/OnboardingHeader';

type Props = NativeStackScreenProps<any, any>;

const SURGERY_OPTS = ['Yes', 'No', 'Not sure'];
const ONSET_OPTS = [
  ['Less than 1 week', '1-4 weeks'],
  ['1-3 months', '3+ months', 'Not sure'],
];
const PAIN_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function KneeIntakeScreen({ navigation, route }: Props) {
  const { area = 'Knee', side = '', returnTo } = (route.params as any) ?? {};
  const [surgery, setSurgery] = useState('');
  const [onset, setOnset] = useState('');
  const [pain, setPain] = useState(0);

  const canContinue = surgery && onset && pain > 0;

  const handleContinue = () => {
    navigation.navigate('SafetyCheck', { area, side, surgery, onset, pain, returnTo });
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <OnboardingHeader
          label="Now, your care"
          title={`Tell us a little about your ${area.toLowerCase()}`}
          subtitle="A few quick details will help your physiotherapist understand where you're starting from."
          onBack={() => navigation.goBack()}
          progress={{ current: 3, total: 5 }}
        />
        <View style={s.body}>
          {/* Q1: Surgery */}
          <View style={s.question}>
            <View style={s.qRow}>
              <View style={s.qNum}><Text style={s.qNumText}>1</Text></View>
              <Text style={s.qText}>Have you had surgery on this {area.toLowerCase()}?</Text>
            </View>
            <View style={s.optRow}>
              {SURGERY_OPTS.map(o => (
                <TouchableOpacity
                  key={o}
                  style={[s.opt, surgery === o && s.optActive]}
                  onPress={() => setSurgery(o)}
                >
                  <Text style={[s.optText, surgery === o && s.optTextActive]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Q2: Onset */}
          <View style={s.question}>
            <View style={s.qRow}>
              <View style={s.qNum}><Text style={s.qNumText}>2</Text></View>
              <Text style={s.qText}>When did the problem begin?</Text>
            </View>
            {ONSET_OPTS.map((row, ri) => (
              <View key={ri} style={s.optRow}>
                {row.map(o => (
                  <TouchableOpacity
                    key={o}
                    style={[s.opt, onset === o && s.optActive]}
                    onPress={() => setOnset(o)}
                  >
                    <Text style={[s.optText, onset === o && s.optTextActive]}>{o}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {/* Q3: Pain scale */}
          <View style={s.question}>
            <View style={s.qRow}>
              <View style={s.qNum}><Text style={s.qNumText}>3</Text></View>
              <View>
                <Text style={s.qText}>How much pain are you feeling right now?</Text>
                <Text style={s.qHint}>Move the slider to the number that feels right.</Text>
              </View>
            </View>
            <View style={s.painRow}>
              {PAIN_LEVELS.map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.painBtn, pain === n && s.painBtnActive]}
                  onPress={() => setPain(n)}
                >
                  <Text style={[s.painText, pain === n && s.painTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, !canContinue && s.btnDisabled]}
            onPress={handleContinue}
            disabled={!canContinue}
          >
            <Text style={s.btnText}>Continue</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.footer}>More care areas are coming soon</Text>
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
  question: { gap: 20 },
  qRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  qNum: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: '#333', alignItems: 'center', justifyContent: 'center',
  },
  qNumText: { fontSize: 11, color: '#fff', fontWeight: '500' },
  qText: { fontSize: 13, color: '#333', fontWeight: '500', lineHeight: 20, flex: 1 },
  qHint: { fontSize: 11, color: '#333', lineHeight: 18, marginTop: 2 },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  opt: {
    borderWidth: 1, borderColor: '#333', borderRadius: 11,
    paddingHorizontal: 14, height: 48, alignItems: 'center', justifyContent: 'center',
  },
  optActive: { backgroundColor: '#333' },
  optText: { fontSize: 15, color: '#333' },
  optTextActive: { color: '#fff' },
  painRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  painBtn: {
    width: 36, height: 36, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(51,51,51,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  painBtnActive: { backgroundColor: '#333', borderColor: '#333' },
  painText: { fontSize: 14, color: '#333' },
  painTextActive: { color: '#fff' },
  btnRow: { paddingHorizontal: 23, marginTop: 30 },
  btn: {
    backgroundColor: '#333', borderRadius: 17, height: 47,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#333', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 6,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  footer: { fontSize: 12, color: '#333', textAlign: 'center', marginTop: 20 },
});
