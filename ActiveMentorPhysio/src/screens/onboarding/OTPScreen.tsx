import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import OnboardingHeader from '../../components/OnboardingHeader';
import api from '../../config/api';

type Props = NativeStackScreenProps<any, any>;

export default function OTPScreen({ navigation, route }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const inputRef = useRef<any>(null);
  const email = (route.params as any)?.email ?? '';
  const devCode = (route.params as any)?.devCode ?? '';

  useEffect(() => {
    console.log('[OTPScreen] mount', { email, devCode });
    if (devCode) setCode(devCode);
    return () => console.log('[OTPScreen] unmount');
  }, []);

  const handleVerify = async () => {
    if (code.length < 6) return;
    setLoading(true);
    setError('');
    console.log('[OTPScreen] verify-otp →', { email, code });
    try {
      const res = await api.post('/auth/verify-otp', { email, code });
      console.log('[OTPScreen] verify-otp ✓', res.data);
      navigation.navigate('UserDetails', { email });
    } catch (e: any) {
      console.log('[OTPScreen] verify-otp ✗', e?.response?.status, e?.response?.data);
      setError(e?.response?.data?.message || 'Invalid code. Try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setResent(false);
    console.log('[OTPScreen] resend-otp →', { email });
    try {
      const res = await api.post('/auth/send-otp', { email });
      console.log('[OTPScreen] resend-otp ✓', res.data);
      setResent(true);
      setCode('');
    } catch (e: any) {
      console.log('[OTPScreen] resend-otp ✗', e?.response?.status, e?.response?.data);
      setError('Could not resend. Try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={s.container}>
        <OnboardingHeader
          label="Verify your email"
          title="Enter verification code"
          subtitle={`We sent a 6-digit code to ${email}`}
          onBack={() => navigation.goBack()}
        />
        <View style={s.body}>
          <TouchableOpacity style={s.otpRow} onPress={() => inputRef.current?.focus()} activeOpacity={1}>
            {[0, 1, 2, 3, 4, 5].map(i => {
              const filled = i < code.length;
              const active = i === code.length;
              return (
                <View key={i} style={[s.box, active && s.boxActive, filled && s.boxFilled]}>
                  {filled
                    ? <Text style={s.digit}>{code[i]}</Text>
                    : active
                      ? <View style={s.cursor} />
                      : null}
                </View>
              );
            })}
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={s.hiddenInput}
            value={code}
            onChangeText={t => { setCode(t.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
            keyboardType="number-pad"
            maxLength={6}
            caretHidden
            autoFocus
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          {resent ? <Text style={s.success}>Code resent — check your inbox.</Text> : null}
          <TouchableOpacity
            style={[s.btn, code.length < 6 && s.btnDisabled]}
            onPress={handleVerify}
            disabled={loading || code.length < 6}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Verify & Continue</Text>}
          </TouchableOpacity>
          <View style={s.resendRow}>
            <Text style={s.resendText}>Didn't receive the code? </Text>
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              {resending
                ? <ActivityIndicator size="small" color="#333" />
                : <Text style={s.resendLink}>Resend</Text>}
            </TouchableOpacity>
          </View>
        </View>
        <Text style={s.footer}>Check your spam folder if you don't see it.</Text>
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#fff' },
  kav:        { flex: 1 },
  scroll:     { flexGrow: 1 },
  container:  { flex: 1, backgroundColor: '#fff' },
  body:       { paddingHorizontal: 23, marginTop: 40 },
  otpRow:     { flexDirection: 'row', gap: 11, marginBottom: 16 },
  box: {
    flex: 1, height: 49, borderRadius: 12,
    borderWidth: 0.8, borderColor: 'rgba(51,51,51,0.2)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  boxActive:  { borderWidth: 1.2, borderColor: '#333' },
  boxFilled:  { borderBottomWidth: 1.2, borderColor: '#333', borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderRadius: 0 },
  digit:      { fontSize: 18, fontWeight: '600', color: '#333' },
  cursor:     { width: 1.5, height: 18, backgroundColor: '#333' },
  hiddenInput:{ position: 'absolute', opacity: 0, height: 0, width: 0 },
  error:      { color: '#c0392b', fontSize: 13, marginBottom: 12 },
  success:    { color: '#27ae60', fontSize: 13, marginBottom: 12 },
  btn: {
    backgroundColor: '#333', borderRadius: 17, height: 47,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#333', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 6,
    marginBottom: 20,
  },
  btnDisabled:    { opacity: 0.4 },
  btnText:        { color: '#fff', fontSize: 14, fontWeight: '500' },
  resendRow:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendText:     { fontSize: 14, color: '#333' },
  resendLink:     { fontSize: 14, color: '#333', textDecorationLine: 'underline' },
  footer: {
    fontSize: 12, color: '#333', textAlign: 'center',
    marginTop: 32, paddingHorizontal: 23, paddingBottom: 40,
  },
});
