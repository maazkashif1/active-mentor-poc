import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingHeader from '../../components/OnboardingHeader';
import { useAuth } from '../../navigation';
import { register } from '../../services/authService';
import api from '../../config/api';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

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

export default function UserDetailsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const emailFromOtp = (route.params as any)?.email ?? '';

  const [firstName, setFirstName] = useState('');
  const [dob, setDob] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  const pwOk = password.length >= 6;
  const match = password.length > 0 && password === confirm;
  const canContinue = !!(firstName && dob && pwOk && match) && !loading;

  const handleContinue = async () => {
    if (!canContinue) return;
    if (!pwOk) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!match) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await register(firstName, emailFromOtp, password);
      try {
        await api.patch('/users/profile', { firstName, dob, city });
      } catch {
        // Local profile still saved; server sync can retry later from intake
      }
      await AsyncStorage.setItem(
        'userProfile',
        JSON.stringify({ firstName, dob, email: emailFromOtp, city }),
      );
      signIn(data.user);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not create account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <OnboardingHeader
            label="Your details"
            title="Tell us about yourself"
            subtitle="Set a password so you can sign back in later — then a few care basics."
            onBack={() => navigation.goBack()}
            progress={{ current: 1, total: 5 }}
          />

          <View style={s.form}>
            <Field label="First name*" value={firstName} onChange={setFirstName} autoCapitalize="words" />
            <Field
              label="Date of birth*"
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
            <Field label="City" value={city} onChange={setCity} placeholder="e.g. Lahore" autoCapitalize="words" />

            <View style={s.divider} />
            <Text style={s.sectionLabel}>Account password</Text>
            <Text style={s.sectionHint}>You’ll use this with {emailFromOtp || 'your email'} to log in.</Text>

            <Field
              label="Password*"
              value={password}
              onChange={t => {
                setPassword(t);
                setError('');
              }}
              placeholder="At least 6 characters"
              secure={!showPw}
              autoCapitalize="none"
            />
            <Field
              label="Confirm password*"
              value={confirm}
              onChange={t => {
                setConfirm(t);
                setError('');
              }}
              placeholder="Re-enter password"
              secure={!showPw}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={8} style={s.showRow}>
              <Text style={s.showText}>{showPw ? 'Hide passwords' : 'Show passwords'}</Text>
            </TouchableOpacity>
            {password.length > 0 && !pwOk ? (
              <Text style={s.hintWarn}>Password must be at least 6 characters.</Text>
            ) : null}
            {confirm.length > 0 && !match ? (
              <Text style={s.hintWarn}>Passwords do not match.</Text>
            ) : null}
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.btn, !canContinue && s.btnDisabled]}
            onPress={handleContinue}
            disabled={!canContinue}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={INK} />
            ) : (
              <Text style={s.btnText}>Create account</Text>
            )}
          </TouchableOpacity>
          <Text style={s.footer}>Only the information your care team needs.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = '',
  keyboardType = 'default',
  secure = false,
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  secure?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
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
          placeholderTextColor="rgba(51,51,51,0.3)"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secure}
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  form: {
    paddingHorizontal: H_PAD,
    marginTop: 20 * SCALE,
    gap: 14 * SCALE,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(51,51,51,0.12)',
    marginTop: 8 * SCALE,
    marginBottom: 4 * SCALE,
  },
  sectionLabel: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionHint: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.5)',
    marginTop: -6 * SCALE,
    marginBottom: 4 * SCALE,
  },
  showRow: { alignSelf: 'flex-start', marginTop: -4 * SCALE },
  showText: {
    fontFamily: font('Medium'),
    fontSize: 13 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.55)',
  },
  hintWarn: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: '#a14a3a',
    marginTop: -4 * SCALE,
  },
  btn: {
    marginHorizontal: H_PAD,
    marginTop: 28 * SCALE,
    height: 50 * SCALE,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    fontFamily: font('Medium'),
    fontSize: 15 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  error: {
    fontFamily: font('Light'),
    color: '#a14a3a',
    fontSize: 13 * SCALE,
    marginHorizontal: H_PAD,
    marginTop: 12 * SCALE,
  },
  footer: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.4)',
    textAlign: 'center',
    marginTop: 20 * SCALE,
  },
});

const f = StyleSheet.create({
  wrap: { gap: 6 * SCALE },
  label: {
    fontFamily: font('Medium'),
    fontSize: 13 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  inputWrap: {
    height: 52 * SCALE,
    borderRadius: 14,
    backgroundColor: '#f7f8fb',
    justifyContent: 'center',
    paddingHorizontal: 16 * SCALE,
  },
  input: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: INK,
  },
});
