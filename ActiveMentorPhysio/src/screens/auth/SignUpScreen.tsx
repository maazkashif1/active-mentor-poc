import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { register } from '../../services/authService';
import { useAuth } from '../../navigation';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function SignUpScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSignUp = async () => {
    if (!name || !email || !password) return Alert.alert('Fill in all fields');
    setLoading(true);
    try {
      const data = await register(name.trim(), email.trim(), password);
      signIn(data.user);
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = name.length > 0 && email.length > 0 && password.length >= 6;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Back */}
          <TouchableOpacity style={s.back} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.label}>Create your account</Text>
            <Text style={s.title}>Let's get you set up</Text>
            <Text style={s.subtitle}>Create your ActiveMentor account to start your care journey.</Text>
          </View>

          {/* Fields */}
          <View style={s.fields}>
            <Field label="Full Name" value={name} onChange={setName} placeholder="Your name" />
            <Field
              label="Email Address"
              value={email}
              onChange={setEmail}
              placeholder="abc@mail.com"
              keyboardType="email-address"
            />
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Password</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Min. 6 characters"
                  placeholderTextColor="rgba(51,51,51,0.2)"
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
                  <Text style={s.showToggle}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.btn, !canSubmit && s.btnDisabled]}
            onPress={handleSignUp}
            disabled={loading || !canSubmit}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Create Account</Text>}
          </TouchableOpacity>

          <View style={s.switchRow}>
            <Text style={s.switchText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={s.switchLink}>Log in</Text>
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

function Field({ label, value, onChange, placeholder, keyboardType }: {
  label: string; value: string; onChange: (t: string) => void;
  placeholder: string; keyboardType?: any;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
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
  scroll: { paddingHorizontal: 23, paddingTop: 60, paddingBottom: 40 },
  back: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(51,51,51,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 30,
  },
  backArrow: { fontSize: 16, color: '#333', lineHeight: 20 },
  header: { marginBottom: 36, gap: 6 },
  label: {
    fontSize: 13, color: 'rgba(51,51,51,0.5)',
    letterSpacing: 0.42, textTransform: 'uppercase', marginBottom: 4,
  },
  title: { fontSize: 24, color: '#333', fontWeight: '600', lineHeight: 30 },
  subtitle: { fontSize: 13, color: '#333', lineHeight: 20 },
  fields: { gap: 20, marginBottom: 36 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 13, color: '#333', fontWeight: '500', lineHeight: 20 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#333',
    height: 48, paddingHorizontal: 4,
  },
  input: { flex: 1, fontSize: 14, color: '#333' },
  showToggle: { fontSize: 13, color: 'rgba(51,51,51,0.5)', fontWeight: '500' },
  btn: {
    backgroundColor: '#333', borderRadius: 17, height: 47,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#333', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 6,
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  switchText: { fontSize: 14, color: '#333' },
  switchLink: { fontSize: 14, color: '#333', fontWeight: '600', textDecorationLine: 'underline' },
  footer: { fontSize: 12, color: '#333', textAlign: 'center', lineHeight: 18 },
  footerLink: { textDecorationLine: 'underline' },
});
