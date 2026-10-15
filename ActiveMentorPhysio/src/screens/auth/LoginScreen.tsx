import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { login } from '../../services/authService';
import { useAuth } from '../../navigation';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Fill in all fields');
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      signIn(data.user);
    } catch (e: any) {
      Alert.alert('Login failed', e?.response?.data?.message || e.message);
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
        <View style={s.container}>
          {/* Brand */}
          <View style={s.brand}>
            <Text style={s.brandLabel}>ACTIVE MENTOR</Text>
            <Text style={s.brandTitle}>Welcome back</Text>
            <Text style={s.brandSub}>Sign in to continue your care journey.</Text>
          </View>

          {/* Fields */}
          <View style={s.fields}>
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
                  placeholder="••••••••"
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
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.btn, (!email || !password) && s.btnDisabled]}
              onPress={handleLogin}
              disabled={loading || !email || !password}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Log In</Text>}
            </TouchableOpacity>

            <View style={s.switchRow}>
              <Text style={s.switchText}>New patient? Go back and tap </Text>
              <Text style={s.switchLink}>Get Started</Text>
            </View>
          </View>
        </View>
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
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 40 },
  container: { paddingHorizontal: 23 },
  brand: { marginBottom: 48 },
  brandLabel: {
    fontSize: 13, color: 'rgba(51,51,51,0.5)',
    letterSpacing: 0.42, textTransform: 'uppercase', marginBottom: 10,
  },
  brandTitle: { fontSize: 28, color: '#333', fontWeight: '600', lineHeight: 34, marginBottom: 6 },
  brandSub: { fontSize: 13, color: '#333', lineHeight: 20 },
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
  actions: { gap: 20 },
  btn: {
    backgroundColor: '#333', borderRadius: 17, height: 47,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#333', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 6,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  switchText: { fontSize: 14, color: '#333' },
  switchLink: { fontSize: 14, color: '#333', fontWeight: '600', textDecorationLine: 'underline' },
});
