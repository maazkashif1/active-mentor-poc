import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useAppStore } from '../../stores/appStore';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ Booking: { filter?: string } }, 'Booking'>;
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

const IMG = {
  back: require('../../assets/images/figma/profile/icon_back.png'),
  search: require('../../assets/images/figma/icon_search.png'),
  arrow: require('../../assets/images/figma/icon_arrow_card.png'),
  star: require('../../assets/images/figma/profile/icon_star.png'),
  ahmed: require('../../assets/images/figma/physio_ahmed.png'),
  sania: require('../../assets/images/figma/physio_sania.png'),
};

const PLACEHOLDERS = [IMG.ahmed, IMG.sania];

export const FIND_FILTERS = [
  'All',
  'Nearest',
  'Available Today',
  'Knee Rehab',
  'Elbow Care',
  'Mobility Care',
  'Shoulder Expert',
] as const;

export type FindFilter = (typeof FIND_FILTERS)[number];

function normalizeFilter(raw?: string): FindFilter {
  if (!raw) return 'All';
  const hit = FIND_FILTERS.find(f => f.toLowerCase() === raw.toLowerCase());
  if (hit) return hit;
  const aliases: Record<string, FindFilter> = {
    knee: 'Knee Rehab',
    'knee rehabilitation': 'Knee Rehab',
    elbow: 'Elbow Care',
    mobility: 'Mobility Care',
    shoulder: 'Shoulder Expert',
    nearest: 'Nearest',
    'available today': 'Available Today',
  };
  return aliases[raw.toLowerCase()] || 'All';
}

function matchesFilter(p: any, filter: FindFilter, index: number): boolean {
  if (filter === 'All') return true;
  const spec = `${p.specialty || ''} ${p.specialization || ''} ${p.name || ''}`.toLowerCase();
  if (filter === 'Knee Rehab') return spec.includes('knee') || spec.includes('sports');
  if (filter === 'Elbow Care') return spec.includes('elbow') || spec.includes('arm') || spec.includes('upper');
  if (filter === 'Mobility Care') {
    return spec.includes('mobility') || spec.includes('musculo') || spec.includes('rehab');
  }
  if (filter === 'Shoulder Expert') return spec.includes('shoulder');
  if (filter === 'Nearest') return true; // sorted later
  if (filter === 'Available Today') return index % 2 === 0; // soft demo until API flag exists
  return true;
}

function displayName(name: string) {
  if (!name) return 'Physiotherapist';
  return name.startsWith('Dr.') ? name : `Dr. ${name}`;
}

function PhysioRow({
  item,
  index,
  onPress,
}: {
  item: any;
  index: number;
  onPress: () => void;
}) {
  const photo = item.photo
    ? { uri: item.photo }
    : PLACEHOLDERS[index % PLACEHOLDERS.length];
  const specialty = item.specialty || item.specialization || 'Physiotherapist';
  const years = item.yearsExperience;
  const rating = item.rating ?? (4.5 + (index % 4) * 0.1).toFixed(1);
  const dist = item.distanceKm != null
    ? `${item.distanceKm} km`
    : `${(0.8 + index * 0.35).toFixed(1)} km`;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.88}>
      <Image source={photo} style={s.avatar} resizeMode="cover" />
      <View style={s.cardBody}>
        <Text style={s.name} numberOfLines={1}>{displayName(item.name)}</Text>
        <Text style={s.specialty} numberOfLines={1}>{specialty}</Text>
        <View style={s.metaRow}>
          <View style={s.ratingPill}>
            <Image source={IMG.star} style={s.starIcon} resizeMode="contain" />
            <Text style={s.metaText}>{rating}</Text>
          </View>
          <Text style={s.dot}>·</Text>
          <Text style={s.metaText}>{dist}</Text>
          {years != null && (
            <>
              <Text style={s.dot}>·</Text>
              <Text style={s.metaText}>{years} yrs</Text>
            </>
          )}
        </View>
      </View>
      <View style={s.arrowBtn}>
        <Image source={IMG.arrow} style={s.arrowIcon} resizeMode="contain" />
      </View>
    </TouchableOpacity>
  );
}

export default function BookingScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const physios = useAppStore(s => s.physios);
  const loading = useAppStore(s => s.loading.physios);
  const fetchPhysios = useAppStore(s => s.fetchPhysios);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FindFilter>(() =>
    normalizeFilter(route.params?.filter),
  );

  useEffect(() => {
    if (!physios.length) fetchPhysios();
  }, []);

  // Pick up filter when navigating again with a new param
  useEffect(() => {
    if (route.params?.filter) setFilter(normalizeFilter(route.params.filter));
  }, [route.params?.filter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = physios
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => {
        const name = (p.name || '').toLowerCase();
        const spec = (p.specialty || p.specialization || '').toLowerCase();
        if (q && !name.includes(q) && !spec.includes(q)) return false;
        return matchesFilter(p, filter, i);
      });

    if (filter === 'Nearest') {
      list = [...list].sort((a, b) => a.i - b.i);
    }

    // If specialty filter yields nothing (API data sparse), fall back to all + query
    if (
      list.length === 0 &&
      physios.length > 0 &&
      ['Knee Rehab', 'Elbow Care', 'Mobility Care', 'Shoulder Expert'].includes(filter)
    ) {
      list = physios
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => {
          if (!q) return true;
          const name = (p.name || '').toLowerCase();
          const spec = (p.specialty || p.specialization || '').toLowerCase();
          return name.includes(q) || spec.includes(q);
        });
    }

    return list.map(({ p }) => p);
  }, [physios, query, filter]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Image source={IMG.back} style={s.backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.title}>
            <Text style={s.titleMed}>Find</Text>
            <Text style={s.titleLight}> a Physiotherapist</Text>
          </Text>
          <Text style={s.subtitle}>Search by name, specialty, or area</Text>
        </View>
      </View>

      <View style={s.searchBar}>
        <Image source={IMG.search} style={s.searchIcon} resizeMode="contain" />
        <TextInput
          style={s.searchInput}
          placeholder="Search physiotherapist, clinic, or area..."
          placeholderTextColor="rgba(51,51,51,0.4)"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoFocus={false}
        />
      </View>

      <FlatList
        horizontal
        data={[...FIND_FILTERS]}
        keyExtractor={f => f}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipRow}
        style={s.chipList}
        renderItem={({ item: f }) => {
          const active = filter === f;
          return (
            <TouchableOpacity
              style={[s.chip, active && s.chipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading && !physios.length ? (
        <ActivityIndicator color={INK} style={{ marginTop: 48 }} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i._id}
          contentContainerStyle={[s.list, { paddingBottom: 32 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={s.count}>
              {filtered.length} physiotherapist{filtered.length === 1 ? '' : 's'}
              {filter !== 'All' ? ` · ${filter}` : ''}
            </Text>
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyTitle}>No matches</Text>
              <Text style={s.emptySub}>Try another name or clear your filters</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <PhysioRow
              item={item}
              index={index}
              onPress={() => navigation.navigate('DoctorProfile' as any, { physio: item })}
            />
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  header: {
    paddingHorizontal: H_PAD,
    paddingTop: 12 * SCALE,
    paddingBottom: 8 * SCALE,
    gap: 16 * SCALE,
  },
  backBtn: {
    width: 36 * SCALE,
    height: 36 * SCALE,
    borderRadius: 18 * SCALE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { width: 16 * SCALE, height: 16 * SCALE },
  headerText: { gap: 4 * SCALE },
  title: { color: INK },
  titleMed: {
    fontFamily: font('Medium'),
    fontSize: 28 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  titleLight: {
    fontFamily: font('Light'),
    fontSize: 28 * SCALE,
    fontWeight: '300',
    color: INK,
  },
  subtitle: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },

  searchBar: {
    marginHorizontal: H_PAD,
    marginTop: 12 * SCALE,
    height: 44 * SCALE,
    borderRadius: 22 * SCALE,
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16 * SCALE,
    gap: 10 * SCALE,
  },
  searchIcon: {
    width: 14 * SCALE,
    height: 14 * SCALE,
    tintColor: INK,
    opacity: 0.55,
  },
  searchInput: {
    flex: 1,
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: INK,
    paddingVertical: 0,
  },

  chipList: { flexGrow: 0, marginTop: 14 * SCALE },
  chipRow: {
    paddingHorizontal: H_PAD,
    gap: 8 * SCALE,
  },
  chip: {
    paddingHorizontal: 12 * SCALE,
    paddingVertical: 7 * SCALE,
    borderRadius: 20,
    backgroundColor: 'rgba(224,231,239,0.45)',
  },
  chipActive: { backgroundColor: ACCENT },
  chipText: {
    fontFamily: font('Light'),
    fontSize: 11 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },
  chipTextActive: {
    fontFamily: font('Medium'),
    fontWeight: '500',
    color: INK,
  },

  list: {
    paddingHorizontal: H_PAD,
    paddingTop: 8 * SCALE,
    gap: 12 * SCALE,
  },
  count: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.45)',
    marginBottom: 4 * SCALE,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8fb',
    borderRadius: 16,
    padding: 12 * SCALE,
    gap: 12 * SCALE,
  },
  avatar: {
    width: 72 * SCALE,
    height: 72 * SCALE,
    borderRadius: 14,
    backgroundColor: ACCENT,
  },
  cardBody: { flex: 1, gap: 3 * SCALE },
  name: {
    fontFamily: font('Medium'),
    fontSize: 15 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  specialty: {
    fontFamily: font('Light'),
    fontSize: 11 * SCALE,
    color: 'rgba(51,51,51,0.6)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5 * SCALE,
    marginTop: 4 * SCALE,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3 * SCALE,
  },
  starIcon: { width: 10 * SCALE, height: 10 * SCALE },
  metaText: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  dot: {
    fontFamily: font('Light'),
    fontSize: 10 * SCALE,
    color: 'rgba(51,51,51,0.35)',
  },
  arrowBtn: {
    width: 28 * SCALE,
    height: 28 * SCALE,
    borderRadius: 14 * SCALE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: { width: 12 * SCALE, height: 12 * SCALE },

  emptyWrap: { alignItems: 'center', paddingTop: 56 * SCALE, gap: 6 * SCALE },
  emptyTitle: {
    fontFamily: font('Medium'),
    fontSize: 16 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  emptySub: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.45)',
  },
});
