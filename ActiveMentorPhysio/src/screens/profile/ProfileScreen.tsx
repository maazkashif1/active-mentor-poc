import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../navigation';
import { useAppStore } from '../../stores/appStore';

type Props = { navigation: NativeStackNavigationProp<any> };

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

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const sessions = useAppStore(s => s.sessions);
  const prescriptions = useAppStore(s => s.prescriptions);
  const fetchSessions = useAppStore(s => s.fetchSessions);
  const fetchPrescriptions = useAppStore(s => s.fetchPrescriptions);

  useEffect(() => {
    AsyncStorage.getItem('userProfile').then(v => {
      if (v) setProfile(JSON.parse(v));
    });
    fetchSessions();
    fetchPrescriptions();
  }, []);

  const first = profile?.firstName || 'Patient';
  const initial = (first[0] || '?').toUpperCase();
  const careArea = profile?.careArea || null;
  const upcoming = sessions.find((s: any) => {
    const d = s.slotDate || s.date;
    return d && d >= new Date().toISOString().split('T')[0];
  });

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Image
            source={require('../../assets/images/figma/profile/icon_back.png')}
            style={s.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text style={s.eyebrow}>Your space</Text>
        <Text style={s.heading}>
          <Text style={s.headingMed}>Hello, </Text>
          <Text style={s.headingLight}>{first}</Text>
        </Text>
        <Text style={s.subhead}>
          {careArea
            ? `${careArea} recovery · keep what matters close`
            : 'Care details, sessions, and shortcuts in one place'}
        </Text>

        {/* Identity card */}
        <View style={s.identity}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>
          <View style={s.identityCopy}>
            <Text style={s.identityName}>{first}</Text>
            {profile?.email ? <Text style={s.identityMeta}>{profile.email}</Text> : null}
            {profile?.city ? <Text style={s.identityMeta}>{profile.city}</Text> : null}
          </View>
        </View>

        {/* Snapshot strip */}
        <View style={s.snapRow}>
          <Snap value={String(sessions.length)} label="Sessions" />
          <Snap value={String(prescriptions.length)} label="Plans" />
          <Snap value={careArea ? careArea.split(' ')[0] : '—'} label="Focus" />
        </View>

        {upcoming ? (
          <TouchableOpacity
            style={s.nextCard}
            onPress={() => navigation.navigate('SessionDetail', { session: upcoming })}
            activeOpacity={0.88}
          >
            <Text style={s.nextEyebrow}>Up next</Text>
            <Text style={s.nextTitle}>
              {upcoming.physiologistId?.name || 'Your physiotherapist'}
            </Text>
            <Text style={s.nextMeta}>
              {(upcoming.slotDate || upcoming.date || 'Date TBD')
                + (upcoming.slotTime || upcoming.time ? ` · ${upcoming.slotTime || upcoming.time}` : '')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Shortcut rails */}
        <Text style={s.sectionLabel}>Shortcuts</Text>
        <View style={s.railCol}>
          <Rail
            tag="Care"
            title="Consultations"
            hint="History & summaries"
            onPress={() => navigation.navigate('ConsultHistory')}
          />
          <Rail
            tag="Move"
            title="Exercises"
            hint={prescriptions.length ? `${prescriptions.length} prescribed` : 'Starter mobility'}
            onPress={() =>
              prescriptions[0]
                ? navigation.navigate('ExerciseMenu', { prescription: prescriptions[0] })
                : navigation.navigate('ExerciseMenu')
            }
          />
          <Rail
            tag="Book"
            title="Find care"
            hint="Specialists near you"
            onPress={() => navigation.navigate('Booking')}
          />
          <Rail
            tag="Plans"
            title="Prescriptions"
            hint="Guided camera sessions"
            onPress={() => navigation.navigate('Prescriptions')}
          />
          <Rail
            tag="Chat"
            title="Message care team"
            hint="Live chat with your physiotherapist"
            onPress={() => {
              const s = sessions.find((x: any) => x.physiologistId) || sessions[0];
              const p = s?.physiologistId;
              if (p && typeof p === 'object' && p._id) {
                navigation.navigate('Chat', {
                  physiologistId: String(p._id),
                  physioName: p.name || 'Physiotherapist',
                });
                return;
              }
              navigation.navigate('Booking');
            }}
          />
        </View>

        {/* Quiet details */}
        {(profile?.dob || profile?.city || profile?.phone) && (
          <>
            <Text style={s.sectionLabel}>About you</Text>
            <View style={s.aboutCard}>
              {profile?.dob ? <Row label="Date of birth" value={profile.dob} /> : null}
              {profile?.city ? <Row label="City" value={profile.city} last={!profile?.phone} /> : null}
              {profile?.phone ? <Row label="Phone" value={profile.phone} last /> : null}
            </View>
          </>
        )}

        <TouchableOpacity style={s.logoutBtn} onPress={signOut} activeOpacity={0.85}>
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Snap({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.snap}>
      <Text style={s.snapValue} numberOfLines={1}>{value}</Text>
      <Text style={s.snapLabel}>{label}</Text>
    </View>
  );
}

function Rail({
  tag,
  title,
  hint,
  onPress,
}: {
  tag: string;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.rail} onPress={onPress} activeOpacity={0.88}>
      <View style={s.railLeft}>
        <Text style={s.railTag}>{tag}</Text>
        <Text style={s.railTitle}>{title}</Text>
        <Text style={s.railHint}>{hint}</Text>
      </View>
      <Text style={s.railArrow}>→</Text>
    </TouchableOpacity>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: H_PAD },
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
    marginBottom: 22 * SCALE,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14 * SCALE,
    backgroundColor: '#f7f8fb',
    borderRadius: 20,
    padding: 16 * SCALE,
    marginBottom: 12 * SCALE,
  },
  avatar: {
    width: 64 * SCALE,
    height: 64 * SCALE,
    borderRadius: 32 * SCALE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font('Medium'),
    fontSize: 26 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  identityCopy: { flex: 1, gap: 2 * SCALE },
  identityName: {
    fontFamily: font('Medium'),
    fontSize: 18 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  identityMeta: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
  snapRow: {
    flexDirection: 'row',
    gap: 8 * SCALE,
    marginBottom: 12 * SCALE,
  },
  snap: {
    flex: 1,
    backgroundColor: '#f7f8fb',
    borderRadius: 16,
    paddingVertical: 14 * SCALE,
    paddingHorizontal: 10 * SCALE,
    alignItems: 'center',
    gap: 2 * SCALE,
  },
  snapValue: {
    fontFamily: font('Medium'),
    fontSize: 16 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  snapLabel: {
    fontFamily: font('Light'),
    fontSize: 11 * SCALE,
    color: 'rgba(51,51,51,0.45)',
  },
  nextCard: {
    backgroundColor: ACCENT,
    borderRadius: 18,
    padding: 16 * SCALE,
    marginBottom: 8 * SCALE,
    gap: 2 * SCALE,
  },
  nextEyebrow: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2 * SCALE,
  },
  nextTitle: {
    fontFamily: font('Medium'),
    fontSize: 16 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  nextMeta: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },
  sectionLabel: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 20 * SCALE,
    marginBottom: 10 * SCALE,
  },
  railCol: { gap: 10 * SCALE },
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8fb',
    borderRadius: 16,
    paddingVertical: 14 * SCALE,
    paddingHorizontal: 16 * SCALE,
  },
  railLeft: { flex: 1, gap: 2 * SCALE },
  railTag: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  railTitle: {
    fontFamily: font('Medium'),
    fontSize: 15 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  railHint: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
  railArrow: {
    fontFamily: font('Light'),
    fontSize: 18 * SCALE,
    color: 'rgba(51,51,51,0.35)',
    marginLeft: 8,
  },
  aboutCard: {
    backgroundColor: '#f7f8fb',
    borderRadius: 16,
    paddingHorizontal: 16 * SCALE,
    marginBottom: 8 * SCALE,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14 * SCALE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(51,51,51,0.08)',
  },
  rowLabel: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.45)',
  },
  rowValue: {
    fontFamily: font('Medium'),
    fontSize: 13 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  logoutBtn: {
    marginTop: 28 * SCALE,
    height: 48 * SCALE,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f8fb',
  },
  logoutText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
});
