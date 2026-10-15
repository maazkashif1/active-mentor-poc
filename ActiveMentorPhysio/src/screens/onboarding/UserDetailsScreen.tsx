import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingHeader from '../../components/OnboardingHeader';
import { useAuth } from '../../navigation';
import { register } from '../../services/authService';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

export default function UserDetailsScreen({ navigation, route }: Props) {
  const emailFromOtp = (route.params as any)?.email ?? '';

  const [firstName, setFirstName] = useState('');
  const [dob, setDob] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  const handleContinue = async () => {
    if (!firstName || !dob) return;
    setLoading(true);
    setError('');
    try {
      // OTP is the auth mechanism — generate a random password the user never needs to know
      const pw = Math.random().toString(36).slice(2) + Date.now().toString(36);
      await register(firstName, emailFromOtp, pw);
      await AsyncStorage.setItem('userProfile', JSON.stringify({ firstName, dob, email: emailFromOtp, city }));
      signIn();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not create account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <OnboardingHeader
          label="Your details"
          title="Tell us about yourself"
          subtitle="This helps your clinic prepare for your care."
          onBack={() => navigation.goBack()}
          progress={{ current: 1, total: 5 }}
        />
        <View style={s.form}>
          <Field label="First Name*" value={firstName} onChange={setFirstName} placeholder="" />
          <Field
            label="Date of Birth*"
            value={dob}
            onChange={t => {
              const clean = t.replace(/[^0-9]/g, '');
              if (clean.length <= 2) setDob(clean);
              else if (clean.length <= 4) setDob(`${clean.slice(0, 2)}/${clean.slice(2)}`);
              else setDob(`${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 8)}`);
            }}
            placeholder="dd/mm/yyyy"
            keyboardType="number-pad"
          />
          <Field label="City" value={city} onChange={setCity} placeholder="e.g; Lahore" />
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, (!firstName || !dob || loading) && s.btnDisabled]}
            onPress={handleContinue}
            disabled={!firstName || !dob || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Continue</Text>}
          </TouchableOpacity>
        </View>
        <Text style={s.footer}>Only the information your care team needs.</Text>
        <View style={{ height: 60 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChange, placeholder = '', keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
}) {
  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <View style={f.inputWrap}>
        <TextInput
          style={f.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="rgba(51,51,51,0.2)"
          keyboardType={keyboardType}
          autoCapitalize="none"
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  kav: { flex: 1 },
  scroll: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 40 },
  form: { paddingHorizontal: 23, marginTop: 30, gap: 15 },
  btnRow: { paddingHorizontal: 23, marginTop: 30 },
  btn: {
    backgroundColor: '#333', borderRadius: 17, height: 47,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#333', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 6,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  error: { color: '#c0392b', fontSize: 13, marginHorizontal: 23, marginTop: 12 },
  footer: { fontSize: 12, color: '#333', textAlign: 'center', marginTop: 30 },
});

const f = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, color: '#333', fontWeight: '500', lineHeight: 20 },
  inputWrap: {
    height: 56, borderBottomWidth: 1, borderBottomColor: '#333',
    justifyContent: 'center', paddingHorizontal: 16,
  },
  input: { fontSize: 14, color: '#333', lineHeight: 21 },
});
