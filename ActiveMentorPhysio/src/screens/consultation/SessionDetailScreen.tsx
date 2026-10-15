import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { getSession } from '../../services/sessionService';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

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
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={s.back}>← Back</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator color="#EC9F05" style={{ marginBottom: 16 }} />}

      <Text style={s.heading}>Consultation Detail</Text>

      {/* Follow-up banner */}
      {followUp && (
        <View style={[s.followUpBanner, followUpDays !== null && followUpDays <= 3 && s.followUpUrgent]}>
          <Text style={s.followUpIcon}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.followUpTitle}>
              {followUpDays === 0
                ? 'Follow-up recommended today'
                : followUpDays !== null && followUpDays < 0
                ? 'Follow-up overdue'
                : `Follow-up recommended in ${followUpDays} day${followUpDays === 1 ? '' : 's'}`}
            </Text>
            <Text style={s.followUpSub}>
              Your physiotherapist suggests booking by{' '}
              {followUp.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <TouchableOpacity
            style={s.followUpBtn}
            onPress={() => navigation.navigate('Booking' as any)}
          >
            <Text style={s.followUpBtnText}>Book</Text>
          </TouchableOpacity>
        </View>
      )}

      <Row label="Physiologist" value={session.physiologistId?.name || '—'} />
      <Row label="Date" value={session.slotDate} />
      <Row label="Time" value={session.slotTime} />
      <Row label="Status" value={session.status} />

      {session.complaints && (
        <Section title="Complaints" body={session.complaints} />
      )}

      {/* SOAP summary — structured or plain text */}
      {soap ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Physiologist Notes</Text>
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
        <Section title="Medical Summary" body={session.aiSummary} />
      ) : null}

      {session.meetingUrl && (session.status === 'pending' || session.status === 'active') && (
        <TouchableOpacity
          style={s.joinBtn}
          onPress={() => navigation.navigate('Meeting', { meetingUrl: session.meetingUrl })}>
          <Text style={s.joinBtnText}>Join Meeting</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
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
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 20, paddingTop: 60 },
  back: { color: '#EC9F05', fontSize: 16, marginBottom: 20 },
  heading: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1a1a1a' },
  rowLabel: { color: '#888', fontSize: 14 },
  rowValue: { color: '#fff', fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
  section: { marginTop: 24, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16 },
  sectionTitle: { color: '#EC9F05', fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  sectionBody: { color: '#ccc', fontSize: 14, lineHeight: 22 },
  soapItem: { marginBottom: 14 },
  soapLabel: { color: '#EC9F05', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  soapBody: { color: '#ccc', fontSize: 14, lineHeight: 21 },
  followUpBanner: {
    backgroundColor: '#1a2a1a', borderWidth: 1, borderColor: '#22c55e40',
    borderRadius: 12, padding: 14, marginBottom: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  followUpUrgent: { backgroundColor: '#2a1a0a', borderColor: '#EC9F0540' },
  followUpIcon: { fontSize: 22 },
  followUpTitle: { color: '#22c55e', fontSize: 14, fontWeight: '600' },
  followUpSub: { color: '#888', fontSize: 12, marginTop: 2 },
  followUpBtn: { backgroundColor: '#22c55e', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  followUpBtnText: { color: '#000', fontSize: 13, fontWeight: '600' },
  joinBtn: { backgroundColor: '#4CAF50', borderRadius: 25, padding: 16, alignItems: 'center', marginTop: 32 },
  joinBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
