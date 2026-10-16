import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import OnboardingHeader from '../../components/OnboardingHeader';
import api from '../../config/api';

type Props = { navigation: NativeStackNavigationProp<any> };

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function PhoneScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('[PhoneScreen] mount');
    return () => console.log('[PhoneScreen] unmount');
  }, []);

  const handleSend = async () => {
    if (!isValidEmail(email)) return;
    setLoading(true);
    setError('');
    console.log('[PhoneScreen] send-otp →', email);
    try {
      const res = await api.post('/auth/send-otp', { email });
      console.log('[PhoneScreen] send-otp ✓', res.data);
      navigation.navigate('OTP', {
        email,
        ...(__DEV__ && res.data?.devCode ? { devCode: res.data.devCode } : {}),
      });
    } catch (e: any) {
      console.log('[PhoneScreen] send-otp ✗', e?.response?.status, e?.response?.data);
      setError(e?.response?.data?.message || 'Could not send code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <OnboardingHeader
            label="Create your account"
            title="Let's get you set up"
            subtitle="We'll send a 6-digit code to your email to verify it's you."
            onBack={() => navigation.goBack()}
          />
          <View style={s.form}>
            <Text style={s.inputLabel}>Email Address</Text>
            <TextInput
              style={s.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(51,51,51,0.2)"
              value={email}
              onChangeText={t => { setEmail(t.trim()); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[s.btn, !isValidEmail(email) && s.btnDisabled]}
              onPress={handleSend}
              disabled={loading || !isValidEmail(email)}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Send Code</Text>}
            </TouchableOpacity>
          </View>
          <Text style={s.footer}>
            By continuing, you agree to ActiveMentor's{' '}
            <Text style={s.footerLink}>Terms of Use</Text>
            {' '}and{' '}
            <Text style={s.footerLink}>Privacy Policy.</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#fff' },
  kav:        { flex: 1 },
  scroll:     { flexGrow: 1, paddingBottom: 40 },
  form:       { paddingHorizontal: 23, marginTop: 32 },
  inputLabel: { fontSize: 13, color: '#333', fontWeight: '500', marginBottom: 8 },
  input: {
    borderWidth: 1.1, borderColor: 'rgba(51,51,51,0.15)',
    borderRadius: 13, height: 54, paddingHorizontal: 16,
    fontSize: 16, color: '#333', marginBottom: 8,
  },
  error:      { color: '#c0392b', fontSize: 13, marginBottom: 12 },
  btn: {
    backgroundColor: '#333', borderRadius: 17, height: 47,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#333', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 6,
    marginTop: 16,
  },
  btnDisabled: { opacity: 0.4 },
  btnText:    { color: '#fff', fontSize: 14, fontWeight: '500' },
  footer: {
    fontSize: 12, color: '#333', textAlign: 'center', lineHeight: 18,
    marginTop: 32, paddingHorizontal: 23,
  },
  footerLink: { textDecorationLine: 'underline' },
});
