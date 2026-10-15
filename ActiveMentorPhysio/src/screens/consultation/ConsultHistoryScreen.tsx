import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAppStore } from '../../stores/appStore';

type Props = { navigation: NativeStackNavigationProp<any> };

const STATUS_LABEL: Record<string, string> = {
  pending: 'Scheduled',
  active: 'In Progress',
  summarised: 'Summary Ready',
  approved: 'Approved',
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#EC9F05',
  active: '#4CAF50',
  summarised: '#2196F3',
  approved: '#9C27B0',
};

export default function ConsultHistoryScreen({ navigation }: Props) {
  const sessions = useAppStore(s => s.sessions);
  const loading = useAppStore(s => s.loading.sessions);
  const fetchSessions = useAppStore(s => s.fetchSessions);

  useFocusEffect(useCallback(() => { fetchSessions(); }, []));

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#EC9F05" size="large" /></View>;
  }

  return (
    <View style={s.container}>
      <Text style={s.heading}>Consultations</Text>
      <FlatList
        data={sessions}
        keyExtractor={i => i._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSessions} tintColor="#EC9F05" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('SessionDetail', { session: item })}>
            <View style={s.cardRow}>
              <Text style={s.name}>{item.physiologistId?.name || 'Physiologist'}</Text>
              <View style={[s.badge, { backgroundColor: STATUS_COLOR[item.status] || '#555' }]}>
                <Text style={s.badgeText}>{STATUS_LABEL[item.status] || item.status}</Text>
              </View>
            </View>
            <Text style={s.sub}>{item.slotDate} · {item.slotTime}</Text>
            {item.status === 'approved' && (
              <Text style={s.action}>Tap to view summary →</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={s.empty}>No sessions yet. Book a consultation to get started.</Text>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  heading: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sub: { color: '#888', fontSize: 13 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  action: { color: '#EC9F05', fontSize: 13, marginTop: 6 },
  empty: { color: '#555', textAlign: 'center', marginTop: 60, lineHeight: 22 },
});
