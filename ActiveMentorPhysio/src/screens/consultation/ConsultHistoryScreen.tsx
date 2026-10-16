import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
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

const STATUS_LABEL: Record<string, string> = {
  pending: 'Scheduled',
  active: 'In Progress',
  summarised: 'Summary Ready',
  approved: 'Approved',
  missed: 'Missed',
};

export default function ConsultHistoryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const sessions = useAppStore(s => s.sessions);
  const loading = useAppStore(s => s.loading.sessions);
  const fetchSessions = useAppStore(s => s.fetchSessions);

  useFocusEffect(useCallback(() => { fetchSessions(); }, []));

  if (loading && !sessions.length) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={INK} size="large" />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="dark-content" />
      <TouchableOpacity
        style={s.backBtn}
        onPress={() => navigation.navigate('NewHome' as any)}
        activeOpacity={0.85}
      >
        <Image
          source={require('../../assets/images/figma/profile/icon_back.png')}
          style={s.backIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>
      <Text style={s.heading}>
        <Text style={s.headingMed}>Your </Text>
        <Text style={s.headingLight}>consultations</Text>
      </Text>
      <Text style={s.subhead}>Sessions you’ve booked and completed</Text>

      <FlatList
        data={sessions}
        keyExtractor={i => i._id}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchSessions} tintColor={INK} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('SessionDetail', { session: item })}
            activeOpacity={0.88}
          >
            <View style={s.cardRow}>
              <Text style={s.name}>{item.physiologistId?.name || 'Physiotherapist'}</Text>
              <View style={s.badge}>
                <Text style={s.badgeText}>{STATUS_LABEL[item.status] || item.status}</Text>
              </View>
            </View>
            <Text style={s.meta}>
              {item.slotDate} · {item.slotTime}
            </Text>
            {item.meetingUrl && (item.status === 'pending' || item.status === 'active') ? (
              <Text style={s.action}>Join meeting →</Text>
            ) : item.status === 'pending' && !item.meetingUrl ? (
              <Text style={s.actionMuted}>Waiting for Meet link</Text>
            ) : item.status === 'approved' ? (
              <Text style={s.action}>View summary →</Text>
            ) : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>No sessions yet</Text>
            <Text style={s.emptyBody}>
              Book a physiotherapist to start your care plan. Your upcoming and past sessions will show up here.
            </Text>
            <TouchableOpacity
              style={s.cta}
              onPress={() => navigation.navigate('Booking' as any)}
              activeOpacity={0.85}
            >
              <Text style={s.ctaText}>Find a Physiotherapist</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: H_PAD },
  center: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    width: 36 * SCALE,
    height: 36 * SCALE,
    borderRadius: 18 * SCALE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16 * SCALE,
  },
  backIcon: { width: 16 * SCALE, height: 16 * SCALE },
  heading: { marginBottom: 4 * SCALE },
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
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.5)',
    marginBottom: 20 * SCALE,
  },
  card: {
    backgroundColor: '#f7f8fb',
    borderRadius: 16,
    padding: 16 * SCALE,
    marginBottom: 12 * SCALE,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontFamily: font('Medium'),
    fontSize: 15 * SCALE,
    fontWeight: '500',
    color: INK,
    flex: 1,
    marginRight: 8,
  },
  meta: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10 * SCALE,
    paddingVertical: 4 * SCALE,
    backgroundColor: ACCENT,
  },
  badgeText: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  action: {
    fontFamily: font('Medium'),
    fontSize: 12 * SCALE,
    color: INK,
    marginTop: 8 * SCALE,
  },
  actionMuted: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.45)',
    marginTop: 8 * SCALE,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 56 * SCALE,
    paddingHorizontal: 12 * SCALE,
    gap: 10 * SCALE,
  },
  emptyTitle: {
    fontFamily: font('Medium'),
    fontSize: 18 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  emptyBody: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    lineHeight: 20 * SCALE,
    color: 'rgba(51,51,51,0.5)',
    textAlign: 'center',
    marginBottom: 8 * SCALE,
  },
  cta: {
    width: '100%',
    height: 44 * SCALE,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: font('Light'),
    fontSize: 15 * SCALE,
    color: INK,
  },
  secondaryLink: {
    fontFamily: font('Medium'),
    fontSize: 13 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.55)',
    marginTop: 4 * SCALE,
  },
});
