import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { getSession } from '../../services/sessionService';

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

function parseSoap(raw: string) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && ('S' in parsed || 'O' in parsed)) return parsed;
  } catch {}
  return null;
}

function daysUntil(dateStr: string) {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export default function SessionDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { session: navSession } = route.params as { session: any };
  const [session, setSession] = useState<any>(navSession);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession(navSession._id)
      .then(setSession)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navSession._id]);

  const soap = parseSoap(session.approvedSummary || session.aiSummary);
  const followUp = session.followUpDate ? new Date(session.followUpDate) : null;
  const followUpDays = followUp ? daysUntil(session.followUpDate) : null;

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Image
            source={require('../../assets/images/figma/profile/icon_back.png')}
            style={s.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text style={s.eyebrow}>Consultation</Text>
        <Text style={s.heading}>
          <Text style={s.headingMed}>Session </Text>
          <Text style={s.headingLight}>detail</Text>
        </Text>

        {loading ? <ActivityIndicator color={INK} style={{ marginBottom: 16 }} /> : null}

        {followUp ? (
          <View style={[s.followUpBanner, followUpDays !== null && followUpDays <= 3 && s.followUpUrgent]}>
            <View style={{ flex: 1 }}>
              <Text style={s.followUpTitle}>
                {followUpDays === 0
                  ? 'Follow-up recommended today'
                  : followUpDays !== null && followUpDays < 0
                    ? 'Follow-up overdue'
                    : `Follow-up in ${followUpDays} day${followUpDays === 1 ? '' : 's'}`}
              </Text>
              <Text style={s.followUpSub}>
                Suggested by{' '}
                {followUp.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
              </Text>
            </View>
            <TouchableOpacity
              style={s.followUpBtn}
              onPress={() => navigation.navigate('Booking' as any)}
              activeOpacity={0.85}
            >
              <Text style={s.followUpBtnText}>Book</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={s.metaCard}>
          <Row label="Physiologist" value={session.physiologistId?.name || '—'} />
          <Row label="Date" value={session.slotDate || '—'} />
          <Row label="Time" value={session.slotTime || '—'} />
          <Row label="Status" value={session.status || '—'} last />
        </View>

        {session.complaints ? <Section title="Complaints" body={session.complaints} /> : null}

        {soap ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Physiologist notes</Text>
            {[
              { key: 'S', label: 'Subjective' },
              { key: 'O', label: 'Objective' },
              { key: 'A', label: 'Assessment' },
              { key: 'P', label: 'Plan' },
            ].map(({ key, label }) =>
              soap[key] ? (
                <View key={key} style={s.soapItem}>
                  <Text style={s.soapLabel}>{label}</Text>
                  <Text style={s.soapBody}>{soap[key]}</Text>
                </View>
              ) : null
            )}
          </View>
        ) : session.aiSummary ? (
          <Section title="Medical summary" body={session.aiSummary} />
        ) : null}

        {session.meetingUrl && (session.status === 'pending' || session.status === 'active') ? (
          <TouchableOpacity
            style={s.joinBtn}
            onPress={() =>
              navigation.navigate('Meeting', {
                sessionId: session._id,
                meetingUrl: session.meetingUrl,
                physioName: session.physiologistId?.name,
                slotDate: session.slotDate,
                slotTime: session.slotTime,
              })
            }
            activeOpacity={0.85}
          >
            <Text style={s.joinBtnText}>Join meeting</Text>
          </TouchableOpacity>
        ) : (session.status === 'pending' || session.status === 'active') && !session.meetingUrl ? (
          <View style={s.noMeetBanner}>
            <Text style={s.noMeetTitle}>No Meet link yet</Text>
            <Text style={s.noMeetBody}>
              Your session is booked. The join link appears here once your physiotherapist connects Google Calendar.
            </Text>
          </View>
        ) : null}

        {session.status === 'missed' ? (
          <View style={s.missedBanner}>
            <Text style={s.missedText}>This appointment was missed.</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Booking' as any)} hitSlop={8}>
              <Text style={s.rebookText}>Rebook →</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
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

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.sectionBody}>{body}</Text>
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
    marginBottom: 12 * SCALE,
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
  heading: { marginBottom: 20 * SCALE },
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
  metaCard: {
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
    textTransform: 'capitalize',
    maxWidth: '58%',
    textAlign: 'right',
  },
  section: {
    marginTop: 16 * SCALE,
    backgroundColor: '#f7f8fb',
    borderRadius: 16,
    padding: 16 * SCALE,
  },
  sectionTitle: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    marginBottom: 10 * SCALE,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionBody: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 22 * SCALE,
    color: 'rgba(51,51,51,0.7)',
  },
  soapItem: { marginBottom: 14 * SCALE },
  soapLabel: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: INK,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4 * SCALE,
  },
  soapBody: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 21 * SCALE,
    color: 'rgba(51,51,51,0.7)',
  },
  followUpBanner: {
    backgroundColor: '#f0f4f8',
    borderRadius: 16,
    padding: 14 * SCALE,
    marginBottom: 16 * SCALE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12 * SCALE,
  },
  followUpUrgent: {
    backgroundColor: ACCENT,
  },
  followUpTitle: {
    fontFamily: font('Medium'),
    fontSize: 14 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  followUpSub: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.5)',
    marginTop: 2 * SCALE,
  },
  followUpBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14 * SCALE,
    paddingVertical: 10 * SCALE,
  },
  followUpBtnText: {
    fontFamily: font('Medium'),
    fontSize: 13 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  joinBtn: {
    height: 52 * SCALE,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28 * SCALE,
  },
  joinBtnText: {
    fontFamily: font('Medium'),
    fontWeight: '500',
    fontSize: 16 * SCALE,
    color: INK,
  },
  noMeetBanner: {
    marginTop: 28 * SCALE,
    backgroundColor: '#f7f8fb',
    borderRadius: 16,
    padding: 16 * SCALE,
    gap: 6 * SCALE,
  },
  noMeetTitle: {
    fontFamily: font('Medium'),
    fontSize: 14 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  noMeetBody: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    lineHeight: 19 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },
  missedBanner: {
    marginTop: 28 * SCALE,
    backgroundColor: '#f7f8fb',
    borderRadius: 16,
    padding: 16 * SCALE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  missedText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: 'rgba(51,51,51,0.55)',
    flex: 1,
    marginRight: 12,
  },
  rebookText: {
    fontFamily: font('Medium'),
    fontSize: 14 * SCALE,
    fontWeight: '500',
    color: INK,
  },
});
