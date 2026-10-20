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
import { useAppStore } from '../../stores/appStore';
import { exerciseDisplayName } from '../../utils/exerciseLabels';

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

// The booking note is built from the intake screens (CareArea → KneeIntake → SafetyCheck),
// one "Label: value" line per answer. Show each answer under the question that was asked.
const SAFETY_QUESTIONS = [
  'Are you currently experiencing fever along with your symptoms?',
  'Does your pain regularly wake you at night or remain severe while resting?',
  'Have you experienced unexplained weight loss?',
];
const DEFAULT_CONCERN = ['Initial assessment', 'Appointment intake'];

type QA = { q: string; a: string; flag?: boolean };

function parseIntake(raw: string): QA[] {
  const out: QA[] = [];
  let area = '';
  String(raw || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const m = line.match(/^(Area|Surgery|Onset|Pain|Safety):\s*(.*)$/i);
      if (!m) {
        const text = line.replace(/^\[seeded\]\s*/i, '');
        if (!DEFAULT_CONCERN.includes(text)) {
          out.push({ q: i === 0 ? 'What brings you in today?' : 'Additional notes', a: text });
        }
        return;
      }
      const key = m[1].toLowerCase();
      const value = m[2].trim();
      if (key === 'area') {
        const am = value.match(/^(.*?)\s*\((.*)\)\s*$/);
        area = am ? am[1] : value;
        out.push({ q: 'Which area needs care?', a: am ? `${am[1]} · ${am[2]}` : value });
      } else if (key === 'surgery') {
        const part = (area || 'area').toLowerCase();
        out.push({ q: `Have you had surgery on ${part === 'joints' ? 'these joints' : `this ${part}`}?`, a: value });
      } else if (key === 'onset') {
        out.push({ q: 'When did the problem begin?', a: value });
      } else if (key === 'pain') {
        out.push({ q: 'How much pain were you feeling?', a: value });
      } else if (key === 'safety') {
        value.split(',').map(v => v.trim()).filter(Boolean).forEach((a, idx) => {
          out.push({ q: SAFETY_QUESTIONS[idx] || `Safety question ${idx + 1}`, a, flag: /^yes$/i.test(a) });
        });
      }
    });
  return out;
}

const sessionIdOf = (p: any) => String(p?.sessionId?._id || p?.sessionId || '');
const timeOf = (p: any) => new Date(p?.updatedAt || p?.createdAt || 0).getTime();

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
  const prescriptions = useAppStore(st => st.prescriptions);
  const rxLoading = useAppStore(st => st.loading.prescriptions);
  const fetchPrescriptions = useAppStore(st => st.fetchPrescriptions);

  useEffect(() => {
    getSession(navSession._id)
      .then(setSession)
      .catch(() => {})
      .finally(() => setLoading(false));
    fetchPrescriptions();
  }, [navSession._id, fetchPrescriptions]);

  const soap = parseSoap(session.approvedSummary || session.aiSummary);
  const approved = session.status === 'approved';
  const intake = parseIntake(session.complaints);
  // The session's current plan = its most recent prescription (the portal edits that one).
  const plan = prescriptions
    .filter((p: any) => sessionIdOf(p) === String(session._id))
    .sort((a: any, b: any) => timeOf(b) - timeOf(a))[0];
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

        {soap ? (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={[s.sectionTitle, { marginBottom: 0 }]}>Consultation summary</Text>
              {!approved ? <Text style={s.draftPill}>Draft</Text> : null}
            </View>
            {!approved ? (
              <Text style={s.draftNote}>Your physiotherapist is still reviewing this summary.</Text>
            ) : null}
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
          <Section title="Consultation summary" body={session.aiSummary} />
        ) : null}

        {/* Exercise plan prescribed in this session */}
        {plan ? (
          <View style={s.planWrap}>
            <Text style={s.planHeading}>Your exercise plan</Text>
            <TouchableOpacity
              style={s.card}
              onPress={() =>
                navigation.navigate('Exercise', {
                  exercise: {
                    id: plan.exerciseId || 'hand_raise',
                    name: exerciseDisplayName(plan),
                    description: plan.notes?.trim() || 'As prescribed by your physiologist',
                  },
                  prescription: plan,
                })
              }
              activeOpacity={0.88}
            >
              <Text style={s.exName}>{exerciseDisplayName(plan)}</Text>
              <Text style={s.exDesc}>{plan.notes?.trim() || 'As prescribed by your physiologist'}</Text>
              <Text style={s.prescDetail}>
                {plan.targetReps} reps · Raise {plan.raiseAngleThreshold}° · Lower {plan.lowerAngleThreshold}°
                {plan.side && plan.side !== 'both' ? ` · ${plan.side} side` : ''}
              </Text>
              <View style={s.cardCta}>
                <Text style={s.start}>Start with camera</Text>
                <Text style={s.startArrow}>→</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : rxLoading && approved ? (
          <ActivityIndicator color={INK} style={{ marginTop: 16 }} />
        ) : approved ? (
          <Section title="Your exercise plan" body="No exercises were prescribed for this session." />
        ) : session.aiSummary || session.transcriptText ? (
          <Section
            title="Your exercise plan"
            body="Your physiotherapist will add exercises here after reviewing this session."
          />
        ) : null}

        {intake.length ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Your intake answers</Text>
            {intake.map(({ q, a, flag }, i) => (
              <View key={`${q}-${i}`} style={[s.qaItem, i === intake.length - 1 && { marginBottom: 0 }]}>
                <Text style={s.qaQ}>{q}</Text>
                <Text style={[s.qaA, flag && s.qaFlag]}>{a}</Text>
              </View>
            ))}
          </View>
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
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10 * SCALE,
  },
  draftPill: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: INK,
    backgroundColor: ACCENT,
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 8 * SCALE,
    paddingVertical: 2 * SCALE,
  },
  draftNote: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.5)',
    marginBottom: 12 * SCALE,
  },
  qaItem: { marginBottom: 12 * SCALE },
  qaQ: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    lineHeight: 17 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
  qaA: {
    fontFamily: font('Medium'),
    fontSize: 14 * SCALE,
    fontWeight: '500',
    color: INK,
    marginTop: 2 * SCALE,
  },
  qaFlag: { color: '#b3392f' },
  // Exercise plan card — same look as the ExerciseMenu "Start with camera" card.
  planWrap: { marginTop: 16 * SCALE },
  planHeading: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    marginBottom: 10 * SCALE,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: '#f7f8fb',
    borderRadius: 18,
    padding: 20 * SCALE,
    gap: 6 * SCALE,
  },
  exName: {
    fontFamily: font('Medium'),
    fontSize: 18 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  exDesc: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
  prescDetail: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.45)',
    marginTop: 2 * SCALE,
  },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12 * SCALE,
    paddingTop: 14 * SCALE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(51,51,51,0.1)',
  },
  start: {
    fontFamily: font('Medium'),
    fontSize: 14 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  startArrow: {
    fontFamily: font('Light'),
    fontSize: 16 * SCALE,
    color: 'rgba(51,51,51,0.4)',
  },
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
