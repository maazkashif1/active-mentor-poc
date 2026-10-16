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
import { exerciseDisplayName } from '../../utils/exerciseLabels';

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

export default function PrescriptionsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const prescriptions = useAppStore(s => s.prescriptions);
  const loading = useAppStore(s => s.loading.prescriptions);
  const fetchPrescriptions = useAppStore(s => s.fetchPrescriptions);

  useFocusEffect(useCallback(() => { fetchPrescriptions(); }, []));

  if (loading && !prescriptions.length) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={INK} size="large" />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="dark-content" />
      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
        <Image
          source={require('../../assets/images/figma/profile/icon_back.png')}
          style={s.backIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <Text style={s.eyebrow}>Analytics</Text>
      <Text style={s.heading}>
        <Text style={s.headingMed}>Prescribed </Text>
        <Text style={s.headingLight}>exercises</Text>
      </Text>
      <Text style={s.subhead}>Camera-guided plans from your physiologist</Text>

      <FlatList
        data={prescriptions}
        keyExtractor={i => i._id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchPrescriptions} tintColor={INK} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('ExerciseMenu', { prescription: item })}
            activeOpacity={0.88}
          >
            <Text style={s.exerciseName}>{exerciseDisplayName(item)}</Text>
            <Text style={s.detail}>Target · {item.targetReps} reps</Text>
            <Text style={s.detail}>
              Raise {item.raiseAngleThreshold}° · Lower {item.lowerAngleThreshold}°
              {item.side && item.side !== 'both' ? ` · ${item.side} side` : ''}
            </Text>
            {item.notes ? <Text style={s.notes}>{item.notes}</Text> : null}
            <View style={s.cardCta}>
              <Text style={s.startText}>Start exercise</Text>
              <Text style={s.startArrow}>→</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>No prescriptions yet</Text>
            <Text style={s.empty}>
              Complete a consultation and your physiologist can send a camera-guided plan here.
            </Text>
            <TouchableOpacity
              style={s.cta}
              onPress={() => navigation.navigate('Booking' as any)}
              activeOpacity={0.85}
            >
              <Text style={s.ctaText}>Find a physiotherapist</Text>
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
    padding: 18 * SCALE,
    marginBottom: 12 * SCALE,
    gap: 4 * SCALE,
  },
  exerciseName: {
    fontFamily: font('Medium'),
    fontSize: 17 * SCALE,
    fontWeight: '500',
    color: INK,
    marginBottom: 4 * SCALE,
  },
  detail: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
  notes: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.55)',
    marginTop: 8 * SCALE,
    fontStyle: 'italic',
  },
  cardCta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12 * SCALE,
    paddingTop: 12 * SCALE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(51,51,51,0.1)',
  },
  startText: {
    fontFamily: font('Medium'),
    fontSize: 14 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  startArrow: {
    fontFamily: font('Light'),
    fontSize: 16 * SCALE,
    color: 'rgba(51,51,51,0.35)',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 48 * SCALE,
    paddingHorizontal: 8 * SCALE,
    gap: 10 * SCALE,
  },
  emptyTitle: {
    fontFamily: font('Medium'),
    fontSize: 17 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  empty: {
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
    fontFamily: font('Medium'),
    fontSize: 14 * SCALE,
    fontWeight: '500',
    color: INK,
  },
});
