import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, SectionList, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, TextInput, Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSlots, bookSession } from '../../services/sessionService';
import { useAppStore } from '../../stores/appStore';

type Props = { navigation: NativeStackNavigationProp<any> };

function avatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=DA7235&color=fff&size=256&bold=true`;
}

function parseTime(t: string): number {
  // "09:00 AM" / "02:00 PM" → minutes since midnight
  const [hm, period] = t.split(' ');
  let [h, m] = hm.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function groupByDay(slots: any[]): { title: string; data: any[] }[] {
  const map = new Map<string, any[]>();
  const sorted = [...slots].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    return dc !== 0 ? dc : parseTime(a.time) - parseTime(b.time);
  });
  for (const s of sorted) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date)!.push(s);
  }
  return Array.from(map.entries()).map(([date, data]) => ({
    title: new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric',
    }),
    data: [data], // one row per day (rendered as a chip group)
  }));
}

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

  useEffect(() => {
    if (!physios.length) fetchPhysios();
  }, []);

  const selectPhysio = async (physio: any) => {
    setSelectedPhysio(physio);
    setSelectedSlot(null);
    setComplaints('');
    setLoading(true);
    try {
      const data = await getSlots(physio._id);
      setSlots(data.filter((s: any) => !s.isBooked));
    } catch {
      Alert.alert('Could not load slots');
    } finally {
      setLoading(false);
    }
  };

  const confirmBooking = async () => {
    if (!selectedSlot || !complaints.trim()) {
      return Alert.alert('Describe your complaints before booking');
    }
    setBooking(true);
    try {
      await bookSession(selectedPhysio._id, selectedSlot.date, selectedSlot.time, complaints);
      Alert.alert('Booked!', 'Your session has been scheduled.', [
        { text: 'OK', onPress: () => navigation.navigate('ConsultHistory') },
      ]);
    } catch (e: any) {
      Alert.alert('Booking failed', e?.response?.data?.message || e.message);
    } finally {
      setBooking(false);
    }
  };

  if (loading || physiosLoading) {
    return <View style={s.center}><ActivityIndicator color="#EC9F05" size="large" /></View>;
  }

  if (!selectedPhysio) {
    return (
      <View style={s.container}>
        <Text style={s.heading}>Choose a Physiologist</Text>
        <FlatList
          data={physios}
          keyExtractor={i => i._id}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => selectPhysio(item)}>
              <Image
                source={{ uri: item.photo || avatarUrl(item.name) }}
                style={s.avatar}
              />
              <View style={s.cardInfo}>
                <Text style={s.name}>{item.name}</Text>
                {item.specialty ? <Text style={s.specialty}>{item.specialty}</Text> : null}
                {item.yearsExperience ? (
                  <Text style={s.sub}>{item.yearsExperience} yrs experience</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={s.empty}>No physiologists available</Text>}
        />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <TouchableOpacity onPress={() => setSelectedPhysio(null)}>
        <Text style={s.back}>← Back</Text>
      </TouchableOpacity>

      {/* Selected physio header */}
      <View style={s.physioHeader}>
        <Image
          source={{ uri: selectedPhysio.photo || avatarUrl(selectedPhysio.name) }}
          style={s.avatarLarge}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.heading}>{selectedPhysio.name}</Text>
          {selectedPhysio.specialty ? <Text style={s.specialty}>{selectedPhysio.specialty}</Text> : null}
        </View>
      </View>

      <Text style={s.slotsLabel}>Available slots</Text>
      <SectionList
        sections={groupByDay(slots)}
        keyExtractor={(_, i) => String(i)}
        renderSectionHeader={({ section }) => (
          <Text style={s.dayHeader}>{section.title}</Text>
        )}
        renderItem={({ item: daySlots }) => (
          <View style={s.chipRow}>
            {daySlots.map((slot: any) => (
              <TouchableOpacity
                key={slot._id}
                style={[s.chip, selectedSlot?._id === slot._id && s.chipSelected]}
                onPress={() => setSelectedSlot(slot)}>
                <Text style={[s.chipText, selectedSlot?._id === slot._id && s.chipTextSelected]}>
                  {slot.time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>No available slots</Text>}
        stickySectionHeadersEnabled={false}
      />
      {selectedSlot && (
        <View style={s.footer}>
          <TextInput
            style={s.input}
            placeholder="Describe your complaints…"
            placeholderTextColor="#666"
            value={complaints}
            onChangeText={setComplaints}
            multiline
          />
          <TouchableOpacity style={s.btn} onPress={confirmBooking} disabled={booking}>
            {booking ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Confirm Booking</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  heading: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  back: { color: '#EC9F05', fontSize: 16, marginBottom: 16 },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14,
    marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#333' },
  avatarLarge: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#333', marginRight: 14 },
  cardInfo: { flex: 1 },
  name: { color: '#fff', fontSize: 16, fontWeight: '600' },
  specialty: { color: '#EC9F05', fontSize: 13, marginTop: 2 },
  sub: { color: '#888', fontSize: 12, marginTop: 2 },
  physioHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  slotsLabel: { color: '#aaa', fontSize: 13, marginBottom: 10 },
  dayHeader: { color: '#EC9F05', fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#1a1a1a', borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#333',
  },
  chipSelected: { backgroundColor: '#EC9F05', borderColor: '#EC9F05' },
  chipText: { color: '#ccc', fontSize: 14 },
  chipTextSelected: { color: '#000', fontWeight: '600' },
  empty: { color: '#555', textAlign: 'center', marginTop: 40 },
  footer: { borderTopWidth: 1, borderColor: '#222', paddingTop: 16 },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10,
    padding: 12, marginBottom: 12, fontSize: 14, minHeight: 80,
  },
  btn: { backgroundColor: '#EC9F05', borderRadius: 25, padding: 16, alignItems: 'center' },
  btnText: { fontWeight: 'bold', fontSize: 16, color: '#000' },
});
