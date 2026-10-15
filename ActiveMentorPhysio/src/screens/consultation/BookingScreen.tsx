import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, TextInput, Image, ScrollView, SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSlots, bookSession } from '../../services/sessionService';
import { useAppStore } from '../../stores/appStore';

type Props = { navigation: NativeStackNavigationProp<any> };

function avatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=DA7235&color=fff&size=256&bold=true`;
}

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function to12h(t: string): string {
  let [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

function isFuture(date: string, time: string): boolean {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  if (date > todayStr) return true;
  if (date < todayStr) return false;
  return parseTime(time) > now.getHours() * 60 + now.getMinutes();
}

function getPeriod(time: string): 'Morning' | 'Afternoon' | 'Evening' {
  const h = parseInt(time.split(':')[0], 10);
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

function buildDateChips(slots: any[]): { isoDate: string; num: string; weekday: string }[] {
  const seen = new Set<string>();
  const chips: { isoDate: string; num: string; weekday: string }[] = [];
  const sorted = [...slots].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sorted) {
    if (seen.has(s.date)) continue;
    seen.add(s.date);
    const d = new Date(s.date + 'T12:00:00');
    chips.push({
      isoDate: s.date,
      num: String(d.getDate()),
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }
  return chips.slice(0, 14);
}

// ── Physio list card ───────────────────────────────────────────────────────────

function PhysioListCard({ item, onPress }: { item: any; onPress: () => void }) {
  const photo = item.photo || avatarUrl(item.name);
  return (
    <TouchableOpacity style={lc.card} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: photo }} style={lc.avatar} />
      <View style={lc.info}>
        <Text style={lc.name}>{item.name}</Text>
        {item.specialty ? <Text style={lc.specialty}>{item.specialty}</Text> : null}
        {item.yearsExperience != null && (
          <Text style={lc.sub}>{item.yearsExperience} yrs experience</Text>
        )}
      </View>
      <Text style={lc.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const lc = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EEE' },
  info: { flex: 1, gap: 3 },
  name: { color: '#1A1A2E', fontSize: 15, fontWeight: '600' },
  specialty: { color: '#7B7B9D', fontSize: 12 },
  sub: { color: '#AAAABD', fontSize: 11, marginTop: 2 },
  arrow: { color: '#AAAABD', fontSize: 22 },
});

// ── Doctor Profile view ────────────────────────────────────────────────────────

function DoctorProfile({
  physio, slots, loading, selectedDate, setSelectedDate,
  selectedSlot, setSelectedSlot, complaints, setComplaints,
  booking, onBack, onConfirm,
}: {
  physio: any; slots: any[]; loading: boolean;
  selectedDate: string; setSelectedDate: (d: string) => void;
  selectedSlot: any; setSelectedSlot: (s: any) => void;
  complaints: string; setComplaints: (c: string) => void;
  booking: boolean; onBack: () => void; onConfirm: () => void;
}) {
  console.log('[DoctorProfile] render', { physio: physio?.name, slots: slots.length, selectedDate, selectedSlot: selectedSlot?._id });

  const photo = physio.photo || avatarUrl(physio.name);
  const education = physio.education?.[0];
  const degree = education?.degree || 'MBBS, MD';
  const today = new Date().toISOString().split('T')[0];
  const isAvailableToday = slots.some(s => s.date === today);

  const dateChips = buildDateChips(slots);

  const activeDate = selectedDate || dateChips[0]?.isoDate || '';
  const slotsForDate = slots.filter(s => s.date === activeDate);

  const periods: ('Morning' | 'Afternoon' | 'Evening')[] = ['Morning', 'Afternoon', 'Evening'];

  return (
    <SafeAreaView style={dp.safe}>
      <ScrollView style={dp.scroll} contentContainerStyle={dp.content} showsVerticalScrollIndicator={false}>

        {/* ── Hero header ── */}
        <View style={dp.header}>
          {/* Back + favourite */}
          <View style={dp.topBar}>
            <TouchableOpacity onPress={onBack} style={dp.topBtn}>
              <Text style={dp.topBtnText}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dp.topBtn}>
              <Text style={dp.topBtnText}>♡</Text>
            </TouchableOpacity>
          </View>

          {/* Doctor photo — right side */}
          <Image source={{ uri: photo }} style={dp.heroPhoto} resizeMode="cover" />

          {/* Info — left side */}
          <View style={dp.heroInfo}>
            <View style={dp.ratingRow}>
              <Text style={dp.starIcon}>★</Text>
              <Text style={dp.ratingVal}>4.6</Text>
            </View>
            <Text style={dp.doctorName}>Dr. {physio.name}</Text>
            <Text style={dp.degree}>{degree}</Text>
            {physio.specialty ? <Text style={dp.specialty}>{physio.specialty}</Text> : null}
            {isAvailableToday && (
              <View style={dp.availBadge}>
                <View style={dp.availDot} />
                <Text style={dp.availText}>Available Today</Text>
              </View>
            )}
          </View>

          {/* Action row */}
          <View style={dp.actionRow}>
            <TouchableOpacity style={dp.detailsBtn}>
              <Text style={dp.detailsBtnText}>Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dp.iconBtn}><Text style={dp.iconBtnText}>📞</Text></TouchableOpacity>
            <TouchableOpacity style={dp.iconBtn}><Text style={dp.iconBtnText}>💬</Text></TouchableOpacity>
            <TouchableOpacity style={dp.iconBtn}><Text style={dp.iconBtnText}>🎥</Text></TouchableOpacity>
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={dp.stats}>
          <View style={dp.statItem}>
            <Text style={dp.statVal}>{physio.yearsExperience ?? '—'}</Text>
            <Text style={dp.statLabel}>Years{'\n'}Experience</Text>
          </View>
          <View style={dp.statDivider} />
          <View style={dp.statItem}>
            <Text style={dp.statVal}>3.5k+</Text>
            <Text style={dp.statLabel}>Patients</Text>
          </View>
          <View style={dp.statDivider} />
          <View style={dp.statItem}>
            <Text style={dp.statVal}>1k+</Text>
            <Text style={dp.statLabel}>Reviews</Text>
          </View>
        </View>

        {/* ── Available At ── */}
        <View style={dp.section}>
          <Text style={dp.sectionLabel}>Available At</Text>
          <Text style={dp.sectionHint}>Select one location</Text>
          <View style={dp.hospitalRow}>
            <View style={dp.hospitalInfo}>
              <Text style={dp.hospitalName}>{physio.name}'s Clinic</Text>
              {physio.specialty ? <Text style={dp.hospitalSub}>{physio.specialty}</Text> : null}
            </View>
            <View style={dp.radioSelected} />
          </View>
        </View>

        {/* ── Select Date ── */}
        <View style={dp.section}>
          <View style={dp.sectionHeader}>
            <View>
              <Text style={dp.sectionLabel}>Select Date</Text>
              <Text style={dp.sectionHint}>Only available dates are shown</Text>
            </View>
          </View>
          {loading
            ? <ActivityIndicator color="#1A1A2E" style={{ marginVertical: 12 }} />
            : dateChips.length === 0
              ? <Text style={dp.empty}>No available dates</Text>
              : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dp.dateChips}>
                  {dateChips.map(chip => {
                    const active = chip.isoDate === (activeDate);
                    return (
                      <TouchableOpacity
                        key={chip.isoDate}
                        style={[dp.dateChip, active && dp.dateChipActive]}
                        onPress={() => { setSelectedDate(chip.isoDate); setSelectedSlot(null); }}
                      >
                        <Text style={[dp.dateNum, active && dp.dateTextActive]}>{chip.num}</Text>
                        <Text style={[dp.dateDay, active && dp.dateTextActive]}>{chip.weekday}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
        </View>

        {/* ── Select Time ── */}
        <View style={dp.section}>
          <Text style={dp.sectionLabel}>Select Time</Text>
          <Text style={dp.sectionHint}>Only available times are shown</Text>
          {periods.map(period => {
            const ps = slotsForDate.filter(s => getPeriod(s.time) === period);
            if (!ps.length) return null;
            return (
              <View key={period} style={{ marginBottom: 12 }}>
                <Text style={dp.periodLabel}>{period}</Text>
                <View style={dp.chipRow}>
                  {ps.map((slot: any) => {
                    const active = selectedSlot?._id === slot._id;
                    return (
                      <TouchableOpacity
                        key={slot._id}
                        style={[dp.timeChip, active && dp.timeChipActive]}
                        onPress={() => setSelectedSlot(slot)}
                      >
                        <Text style={[dp.timeChipText, active && dp.timeChipTextActive]}>{to12h(slot.time)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
          {slotsForDate.length === 0 && !loading && (
            <Text style={dp.empty}>No slots for this date</Text>
          )}
        </View>

        {/* ── Complaints (shown once slot picked) ── */}
        {selectedSlot && (
          <View style={dp.section}>
            <Text style={dp.sectionLabel}>Describe your concerns</Text>
            <TextInput
              style={dp.input}
              placeholder="What brings you in today?"
              placeholderTextColor="#AAAABD"
              value={complaints}
              onChangeText={setComplaints}
              multiline
            />
          </View>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ── Fixed Continue button ── */}
      <View style={dp.fixedBottom}>
        <TouchableOpacity
          style={[dp.continueBtn, (!selectedSlot || !complaints.trim()) && dp.continueBtnDisabled]}
          onPress={onConfirm}
          disabled={!selectedSlot || !complaints.trim() || booking}
          activeOpacity={0.85}
        >
          {booking
            ? <ActivityIndicator color="#fff" />
            : <Text style={dp.continueBtnText}>Continue</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const HEADER_BG = '#EAEAF5';
const dp = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { backgroundColor: '#fff' },

  // Hero header
  header: {
    backgroundColor: HEADER_BG, minHeight: 300,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20,
    overflow: 'hidden',
  },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  topBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  topBtnText: { fontSize: 18, color: '#1A1A2E' },

  heroPhoto: {
    position: 'absolute', right: 0, bottom: 0,
    width: '58%', height: 280,
  },

  heroInfo: { width: '55%', gap: 6, paddingBottom: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  starIcon: { color: '#F5A623', fontSize: 14 },
  ratingVal: { color: '#1A1A2E', fontSize: 14, fontWeight: '600' },
  doctorName: { color: '#1A1A2E', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  degree: { color: '#7B7B9D', fontSize: 12 },
  specialty: { color: '#7B7B9D', fontSize: 12 },
  availBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#E6F9F0', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
  },
  availDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#27AE60' },
  availText: { color: '#27AE60', fontSize: 11, fontWeight: '600' },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  detailsBtn: {
    backgroundColor: '#1A1A2E', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 9,
  },
  detailsBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  iconBtnText: { fontSize: 16 },

  // Stats
  stats: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 20, paddingHorizontal: 24,
    borderBottomWidth: 1, borderColor: '#F0F0F5',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { color: '#1A1A2E', fontSize: 16, fontWeight: '700' },
  statLabel: { color: '#AAAABD', fontSize: 11, textAlign: 'center', lineHeight: 15 },
  statDivider: { width: 1, height: 36, backgroundColor: '#F0F0F5' },

  // Sections
  section: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  sectionLabel: { color: '#1A1A2E', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  sectionHint: { color: '#AAAABD', fontSize: 11, marginBottom: 12 },
  empty: { color: '#AAAABD', fontSize: 13, marginTop: 8 },

  // Hospital row
  hospitalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#F0F0F5', borderRadius: 14,
  },
  hospitalInfo: { gap: 2 },
  hospitalName: { color: '#1A1A2E', fontSize: 14, fontWeight: '500' },
  hospitalSub: { color: '#AAAABD', fontSize: 11 },
  radioSelected: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 5, borderColor: '#1A1A2E',
  },

  // Date chips
  dateChips: { gap: 8, paddingRight: 4 },
  dateChip: {
    width: 58, height: 70, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderColor: '#F0F0F5', backgroundColor: '#FAFAFA',
  },
  dateChipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  dateNum: { color: '#1A1A2E', fontSize: 18, fontWeight: '700' },
  dateDay: { color: '#AAAABD', fontSize: 11 },
  dateTextActive: { color: '#fff' },

  // Time chips
  periodLabel: { color: '#AAAABD', fontSize: 12, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    borderRadius: 20, paddingVertical: 9, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#F0F0F5', backgroundColor: '#FAFAFA',
  },
  timeChipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  timeChipText: { color: '#1A1A2E', fontSize: 13 },
  timeChipTextActive: { color: '#fff', fontWeight: '600' },

  // Complaints input
  input: {
    borderWidth: 1, borderColor: '#F0F0F5', borderRadius: 14,
    padding: 14, fontSize: 14, color: '#1A1A2E',
    minHeight: 80, textAlignVertical: 'top',
  },

  // Fixed bottom CTA
  fixedBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: 30,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderColor: '#F0F0F5',
  },
  continueBtn: {
    backgroundColor: '#1A1A2E', borderRadius: 25,
    height: 52, alignItems: 'center', justifyContent: 'center',
  },
  continueBtnDisabled: { opacity: 0.35 },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function BookingScreen({ navigation }: Props) {
  const physios = useAppStore(s => s.physios);
  const physiosLoading = useAppStore(s => s.loading.physios);
  const fetchPhysios = useAppStore(s => s.fetchPhysios);
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedPhysio, setSelectedPhysio] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [complaints, setComplaints] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    console.log('[BookingScreen] mount');
    if (!physios.length) {
      console.log('[BookingScreen] fetching physios');
      fetchPhysios();
    }
    return () => console.log('[BookingScreen] unmount');
  }, []);

  const selectPhysio = async (physio: any) => {
    console.log('[BookingScreen] physio selected', physio.name);
    setSelectedPhysio(physio);
    setSelectedSlot(null);
    setSelectedDate('');
    setComplaints('');
    setLoading(true);
    try {
      const data = await getSlots(physio._id);
      const filtered = data.filter((s: any) => !s.isBooked && isFuture(s.date, s.time));
      console.log('[BookingScreen] slots loaded', filtered.length);
      setSlots(filtered);
    } catch (e) {
      console.log('[BookingScreen] slots error', e);
      Alert.alert('Could not load slots');
    } finally {
      setLoading(false);
    }
  };

  const confirmBooking = async () => {
    if (!selectedSlot || !complaints.trim()) {
      return Alert.alert('Describe your concerns before booking');
    }
    console.log('[BookingScreen] booking →', { physio: selectedPhysio.name, date: selectedSlot.date, time: selectedSlot.time });
    setBooking(true);
    try {
      await bookSession(selectedPhysio._id, selectedSlot.date, selectedSlot.time, complaints);
      console.log('[BookingScreen] booking ✓');
      Alert.alert('Booked!', 'Your session has been scheduled.', [
        { text: 'OK', onPress: () => navigation.navigate('ConsultHistory') },
      ]);
    } catch (e: any) {
      console.log('[BookingScreen] booking ✗', e?.response?.status, e?.response?.data);
      Alert.alert('Booking failed', e?.response?.data?.message || e.message);
    } finally {
      setBooking(false);
    }
  };

  // ── Physio list ──
  if (!selectedPhysio) {
    return (
      <SafeAreaView style={fl.safe}>
        <View style={fl.header}>
          <Text style={fl.title}>Find a Physiotherapist</Text>
          <Text style={fl.sub}>Choose a specialist to view their profile and book</Text>
        </View>
        {physiosLoading
          ? <ActivityIndicator color="#1A1A2E" style={{ marginTop: 40 }} size="large" />
          : (
            <FlatList
              data={physios}
              keyExtractor={i => i._id}
              renderItem={({ item }) => (
                <PhysioListCard item={item} onPress={() => selectPhysio(item)} />
              )}
              contentContainerStyle={fl.list}
              ListEmptyComponent={<Text style={fl.empty}>No physiotherapists available</Text>}
            />
          )}
      </SafeAreaView>
    );
  }

  // ── Doctor profile ──
  return (
    <DoctorProfile
      physio={selectedPhysio}
      slots={slots}
      loading={loading}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      selectedSlot={selectedSlot}
      setSelectedSlot={setSelectedSlot}
      complaints={complaints}
      setComplaints={setComplaints}
      booking={booking}
      onBack={() => setSelectedPhysio(null)}
      onConfirm={confirmBooking}
    />
  );
}

const fl = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  title: { color: '#1A1A2E', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  sub: { color: '#AAAABD', fontSize: 13 },
  list: { paddingHorizontal: 20, paddingTop: 12 },
  empty: { color: '#AAAABD', textAlign: 'center', marginTop: 40 },
});
