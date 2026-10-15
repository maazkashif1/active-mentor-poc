import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import OnboardingHeader from '../../components/OnboardingHeader';

type Props = { navigation: NativeStackNavigationProp<any> };

const LANGUAGES = [
  { id: 'en', name: 'English', subtitle: 'Continue in English', emoji: '🌐' },
  { id: 'ur', name: 'اردو', subtitle: 'اردو میں جاری رکھیں', emoji: '🌐' },
];

export default function LanguageScreen({ navigation }: Props) {
  const [selected, setSelected] = useState('en');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader
          label="Language"
          title="Choose your preferred language"
          subtitle="You can change this anytime in your profile."
          onBack={() => navigation.goBack()}
        />
        <View style={s.list}>
          {LANGUAGES.map(lang => {
            const active = selected === lang.id;
            return (
              <TouchableOpacity
                key={lang.id}
                style={[s.choice, active && s.choiceActive]}
                onPress={() => setSelected(lang.id)}
              >
                <View style={[s.iconBox, active && s.iconBoxActive]}>
                  <Text style={s.iconEmoji}>{lang.emoji}</Text>
                </View>
                <View style={s.choiceText}>
                  <Text style={[s.choiceName, active && s.choiceNameActive]}>{lang.name}</Text>
                  <Text style={[s.choiceSub, active && s.choiceSubActive]}>{lang.subtitle}</Text>
                </View>
                <View style={[s.radio, active && s.radioActive]}>
                  {active && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={s.btnRow}>
          <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('Phone')}>
            <Text style={s.btnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },
  list: { paddingHorizontal: 13, marginTop: 32, gap: 15 },
  choice: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.1, borderColor: 'rgba(51,51,51,0.1)',
    borderRadius: 18, padding: 16, height: 78,
    backgroundColor: '#fff',
  },
  choiceActive: {
    backgroundColor: 'rgba(51,51,51,0.1)',
    borderColor: '#333',
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(51,51,51,0.05)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  iconBoxActive: { backgroundColor: '#333' },
  iconEmoji: { fontSize: 20 },
  choiceText: { flex: 1 },
  choiceName: { fontSize: 16, fontWeight: '600', color: '#333', lineHeight: 24 },
  choiceNameActive: { color: '#333' },
  choiceSub: { fontSize: 14, color: '#333', lineHeight: 20 },
  choiceSubActive: { color: '#333' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.1, borderColor: 'rgba(51,51,51,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { backgroundColor: '#333', borderColor: '#333' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  btnRow: { position: 'absolute', bottom: 40, left: 23, right: 23 },
  btn: {
    backgroundColor: '#333', borderRadius: 17, height: 47,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#333', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 6,
  },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
