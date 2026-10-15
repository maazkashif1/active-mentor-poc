import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  StatusBar,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

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

export default function MeetingScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { meetingUrl, physioName, slotDate, slotTime } =
    route.params as { meetingUrl: string; physioName?: string; slotDate?: string; slotTime?: string };

  async function openMeet() {
    const canOpen = await Linking.canOpenURL(meetingUrl).catch(() => false);
    if (!canOpen) {
      Alert.alert('Cannot open link', 'Could not open Google Meet. Check your internet connection.');
      return;
    }
    await Linking.openURL(meetingUrl);
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar barStyle="dark-content" />
      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
        <Image
          source={require('../../assets/images/figma/profile/icon_back.png')}
          style={s.backIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <Text style={s.eyebrow}>Live session</Text>
      <Text style={s.heading}>
        <Text style={s.headingMed}>Ready to </Text>
        <Text style={s.headingLight}>join</Text>
      </Text>
      <Text style={s.subhead}>Opens Google Meet — come back here when you finish.</Text>

      <View style={s.card}>
        <Text style={s.label}>Your consultation</Text>
        {physioName ? <Text style={s.physio}>{physioName}</Text> : null}
        {slotDate && slotTime ? (
          <Text style={s.time}>{slotDate} · {slotTime}</Text>
        ) : null}
        <View style={s.divider} />
        <Text style={s.hint}>
          Keep this app nearby. When the call ends, mark the session finished below.
        </Text>
      </View>

      <TouchableOpacity style={s.joinBtn} onPress={openMeet} activeOpacity={0.85}>
        <Text style={s.joinText}>Open Google Meet</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.doneBtn}
        onPress={() => navigation.replace('ConsultHistory')}
        activeOpacity={0.85}
      >
        <Text style={s.doneText}>I've finished my session</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: H_PAD },
  backBtn: {
    width: 40 * SCALE,
    height: 40 * SCALE,
    borderRadius: 20 * SCALE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16 * SCALE,
  },
  backIcon: { width: 18 * SCALE, height: 18 * SCALE },
  eyebrow: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6 * SCALE,
  },
  heading: { marginBottom: 6 * SCALE },
  headingMed: {
    fontFamily: font('Medium'),
    fontSize: 28 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  headingLight: {
    fontFamily: font('Light'),
    fontSize: 28 * SCALE,
    fontWeight: '300',
    color: INK,
  },
  subhead: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 20 * SCALE,
    color: 'rgba(51,51,51,0.55)',
    marginBottom: 24 * SCALE,
  },
  card: {
    backgroundColor: '#f7f8fb',
    borderRadius: 20,
    padding: 22 * SCALE,
    marginBottom: 24 * SCALE,
  },
  label: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.4)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10 * SCALE,
  },
  physio: {
    fontFamily: font('Medium'),
    fontSize: 20 * SCALE,
    fontWeight: '500',
    color: INK,
    marginBottom: 4 * SCALE,
  },
  time: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(51,51,51,0.12)',
    marginVertical: 18 * SCALE,
  },
  hint: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    lineHeight: 20 * SCALE,
    color: 'rgba(51,51,51,0.5)',
    textAlign: 'center',
  },
  joinBtn: {
    height: 52 * SCALE,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12 * SCALE,
  },
  joinText: {
    fontFamily: font('Medium'),
    fontSize: 16 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  doneBtn: {
    height: 48 * SCALE,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
});
