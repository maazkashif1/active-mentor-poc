import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  StatusBar,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSlots, bookSession } from '../../services/sessionService';
import { physioPhotoSource } from '../../utils/physioAvatar';
import { clinicImageSource, clinicMapSource, hospitalLogoSource } from '../../utils/hospitals';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ DoctorProfile: { physio: any } }, 'DoctorProfile'>;
};

const SW = Dimensions.get('window').width;
const SCALE = SW / 390;
const H_PAD = 24 * SCALE;
const CONTENT_W = 342 * SCALE;
const ACCENT = '#e0e7ef';
const INK = '#333333';

const font = (weight: 'Light' | 'Regular' | 'Medium' | 'SemiBold' | 'Bold') =>
  Platform.select({
    ios: `Poppins-${weight}`,
    android: `Poppins-${weight}`,
    default: undefined,
  });

const IMG = {
  hero: require('../../assets/images/figma/profile/doctor_hero.png'),
  agakhan: require('../../assets/images/figma/profile/hospital_agakhan.png'),
  ziauddin: require('../../assets/images/figma/profile/hospital_ziauddin.png'),
  map: require('../../assets/images/figma/profile/map_bg.png'),
  back: require('../../assets/images/figma/profile/icon_back.png'),
  heart: require('../../assets/images/figma/profile/icon_heart.png'),
  star: require('../../assets/images/figma/profile/icon_star.png'),
  info: require('../../assets/images/figma/profile/icon_info.png'),
  call: require('../../assets/images/figma/profile/icon_call.png'),
  message: require('../../assets/images/figma/profile/icon_message.png'),
  video: require('../../assets/images/figma/profile/icon_video.png'),
  pin: require('../../assets/images/figma/profile/icon_pin.png'),
  pinMap: require('../../assets/images/figma/profile/icon_pin_map.png'),
  chevron: require('../../assets/images/figma/profile/icon_chevron.png'),
  globe: require('../../assets/images/figma/profile/icon_globe.png'),
  users: require('../../assets/images/figma/profile/icon_users.png'),
  starStat: require('../../assets/images/figma/profile/icon_star_stat.png'),
};

const FALLBACK_CLINICS = [
  {
    id: 'aga',
    name: 'Aga Khan University Hospital',
    logo: hospitalLogoSource('aga_khan') || IMG.agakhan,
    logoKey: 'aga_khan',
    branch: 'Stadium Road / Garden · Karachi',
    hasLogo: true,
  },
  {
    id: 'zia',
    name: 'Dr Ziauddin Hospital',
    logo: hospitalLogoSource('ziauddin') || IMG.ziauddin,
    logoKey: 'ziauddin',
    branch: 'Clifton Campus · Karachi',
    hasLogo: true,
  },
];

function clinicsFromPhysio(physio: any) {
  const list = Array.isArray(physio?.clinics) ? physio.clinics.filter((c: any) => c?.name || c?.branch) : [];
  if (!list.length) return FALLBACK_CLINICS;
  return list.map((c: any, i: number) => {
    const logo = clinicImageSource(c);
    const map = clinicMapSource(c);
    return {
      id: String(c._id || c.placeId || c.logoKey || `clinic-${i}`),
      name: c.name || 'Clinic',
      logo,
      map,
      logoKey: c.logoKey || '',
      branch: [c.branch, c.city || c.address].filter(Boolean).join(' · ') || c.name || 'Clinic',
      hasLogo: !!logo,
      lat: c.lat,
      lng: c.lng,
    };
  });
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

function buildDateChips(slots: any[]) {
  const seen = new Set<string>();
  const chips: { isoDate: string; num: string; weekday: string; month: string }[] = [];
  const sorted = [...slots].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sorted) {
    if (seen.has(s.date)) continue;
    seen.add(s.date);
    const d = new Date(s.date + 'T12:00:00');
    chips.push({
      isoDate: s.date,
      num: String(d.getDate()),
      weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
      month: d.toLocaleDateString('en-US', { month: 'long' }),
    });
  }
  return chips.slice(0, 14);
}

function displayName(physio: any) {
  const n = physio?.name || 'Physiotherapist';
  return n.startsWith('Dr.') ? n : `Dr. ${n}`;
}

export default function DoctorProfileScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const physio = route.params?.physio;
  const [fav, setFav] = useState(false);
  const clinics = useMemo(() => clinicsFromPhysio(physio), [physio]);
  const [hospitalId, setHospitalId] = useState('');
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [complaints, setComplaints] = useState('');
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    if (clinics.length && !clinics.some(c => c.id === hospitalId)) {
      setHospitalId(clinics[0].id);
    }
  }, [clinics, hospitalId]);

  useEffect(() => {
    if (!physio?._id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getSlots(physio._id);
        if (cancelled) return;
        const filtered = (data || []).filter((s: any) => !s.isBooked && isFuture(s.date, s.time));
        setSlots(filtered);
      } catch {
        if (!cancelled) Alert.alert('Could not load availability');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [physio?._id]);

  const dateChips = useMemo(() => buildDateChips(slots), [slots]);
  const activeDate = selectedDate || dateChips[0]?.isoDate || '';
  const slotsForDate = slots.filter(s => s.date === activeDate);
  const today = new Date().toISOString().split('T')[0];
  const availableToday = slots.some(s => s.date === today);
  const hospital = clinics.find(h => h.id === hospitalId) || clinics[0];
  const monthLabel =
    dateChips.find(c => c.isoDate === activeDate)?.month ||
    new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1).toLocaleDateString(
      'en-US',
      { month: 'long' },
    );

  const education = physio?.education?.[0];
  const degree = education?.degree
    || (education?.institution ? education.institution : null)
    || null;
  const specialty = physio?.specialty || physio?.specialization || 'Physiotherapist';
  const years = physio?.yearsExperience;
  const bio = (physio?.bio || '').trim();
  const photoSource = physioPhotoSource(physio);
  const usingRealClinics = Array.isArray(physio?.clinics) && physio.clinics.some((c: any) => c?.name || c?.branch);

  const confirmBooking = async () => {
    if (!selectedSlot) return Alert.alert('Select a time slot');
    if (!physio?._id) return Alert.alert('This profile is unavailable for booking');

    // After time is picked → always run care intake forms, then book
    const note = complaints.trim() || 'Initial assessment';
    setBooking(true);
    try {
      await AsyncStorage.setItem(
        'pendingBooking',
        JSON.stringify({
          physioId: physio._id,
          physioName: physio.name,
          date: selectedSlot.date,
          time: selectedSlot.time,
          complaints: note,
        }),
      );
      navigation.navigate('CareArea' as any, {
        returnTo: 'ConsultHistory',
        fromBooking: true,
      });
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message || 'Please try again');
    } finally {
      setBooking(false);
    }
  };

  if (!physio) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: INK }}>No physiotherapist selected</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: INK }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const periods: ('Morning' | 'Afternoon' | 'Evening')[] = ['Morning', 'Afternoon', 'Evening'];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: 40 * SCALE + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — Figma image 35 h=696 */}
        <View style={s.hero}>
          <Image source={photoSource} style={s.heroImg} resizeMode="cover" />

          <View style={[s.topBar, { top: Math.max(insets.top, 44 * SCALE) + 17 * SCALE }]}>
            <TouchableOpacity style={s.circleBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <Image source={IMG.back} style={s.backIcon} resizeMode="contain" />
            </TouchableOpacity>
            <TouchableOpacity style={s.circleBtn} onPress={() => setFav(v => !v)} activeOpacity={0.85}>
              <Image
                source={IMG.heart}
                style={[s.heartIcon, fav && { tintColor: '#e74c3c' }]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          <View style={s.heroInfo}>
            <Text style={s.doctorName}>{displayName(physio)}</Text>
            {degree ? <Text style={s.degree}>{degree}</Text> : null}
            <Text style={s.specialty}>{specialty}</Text>
          </View>

          {availableToday && (
            <View style={s.availBadge}>
              <Text style={s.availText}>Available Today</Text>
            </View>
          )}

          {/* Glass action bar */}
          <View style={s.actionBar}>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType="light"
              blurAmount={7}
              reducedTransparencyFallbackColor="rgba(51,51,51,0.1)"
            />
            <View style={s.actionBarTint} />
            <View style={s.actionBarInner}>
              <TouchableOpacity style={s.detailsBtn} activeOpacity={0.85}>
                <Image source={IMG.info} style={s.actionIcon} resizeMode="contain" />
                <Text style={s.detailsText}>Details</Text>
              </TouchableOpacity>
              <View style={s.actionIcons}>
                <TouchableOpacity style={s.iconCircle} activeOpacity={0.85}>
                  <Image source={IMG.call} style={s.actionIcon} resizeMode="contain" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.iconCircle}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (!physio?._id) return;
                    navigation.navigate('Chat' as any, {
                      physiologistId: String(physio._id),
                      physioName: displayName(physio),
                    });
                  }}
                >
                  <Image source={IMG.message} style={s.actionIcon} resizeMode="contain" />
                </TouchableOpacity>
                <TouchableOpacity style={s.iconCircle} activeOpacity={0.85}>
                  <Image source={IMG.video} style={s.actionIcon} resizeMode="contain" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Stats card — overlaps hero (only real fields) */}
        <View style={s.statsCard}>
          {[
            years != null
              ? { icon: IMG.globe, val: `${years} Years`, label: 'Experience' }
              : null,
            specialty
              ? { icon: IMG.users, val: specialty.split(/[·,]/)[0].trim().slice(0, 14), label: 'Focus' }
              : null,
            education?.institution
              ? { icon: IMG.starStat, val: String(education.year || 'Cred.'), label: 'Credential' }
              : bio
                ? { icon: IMG.starStat, val: 'Profile', label: 'Verified' }
                : null,
          ].filter(Boolean).map((stat: any) => (
            <View key={stat.label} style={s.statItem}>
              <Image source={stat.icon} style={s.statIcon} resizeMode="contain" />
              <View style={{ maxWidth: 90 * SCALE }}>
                <Text style={s.statVal} numberOfLines={1}>{stat.val}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* White content sheet */}
        <View style={s.sheet}>
          {/* Available At */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Available At</Text>
            <Text style={s.sectionHint}>
              {usingRealClinics ? 'Select one clinic' : 'Select one (demo clinics until physio adds theirs)'}
            </Text>
            <View style={s.hospitalList}>
              {clinics.map(h => {
                const active = h.id === hospitalId;
                return (
                  <TouchableOpacity
                    key={h.id}
                    style={s.hospitalRow}
                    onPress={() => setHospitalId(h.id)}
                    activeOpacity={0.85}
                  >
                    <View style={s.clinicMain}>
                      {h.logo ? (
                        <Image source={h.logo} style={s.hospitalLogo} resizeMode="contain" />
                      ) : (
                        <View style={s.hospitalLogoFallback}>
                          <Text style={s.hospitalLogoFallbackText} numberOfLines={2}>{h.name}</Text>
                        </View>
                      )}
                      <Text style={s.clinicBranch} numberOfLines={2}>{h.branch}</Text>
                    </View>
                    <View style={[s.radio, active && s.radioActive]}>
                      {active ? <View style={s.radioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Branch + live map / place photo */}
          {hospital ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Branch</Text>
              <Text style={s.sectionHint}>Selected location</Text>
              <View style={s.branchChip}>
                <Image source={IMG.pin} style={s.branchPin} resizeMode="contain" />
                <Text style={s.branchText}>{hospital.branch}</Text>
              </View>
              {hospital.map ? (
                <View style={s.mapWrap}>
                  <Image source={hospital.map} style={s.mapImg} resizeMode="cover" />
                  <Image source={IMG.pinMap} style={s.mapPin} resizeMode="contain" />
                </View>
              ) : hospital.logo && !hospital.logoKey ? (
                <View style={s.mapWrap}>
                  <Image source={hospital.logo} style={s.mapImg} resizeMode="cover" />
                </View>
              ) : null}
            </View>
          ) : null}

          {bio ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>About</Text>
              <Text style={s.bioText}>{bio}</Text>
            </View>
          ) : null}

          {Array.isArray(physio?.education) && physio.education.length > 0 ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Education</Text>
              {physio.education.map((edu: any, i: number) => (
                <View key={i} style={s.eduRow}>
                  <Text style={s.eduDegree}>{edu.degree || 'Credential'}</Text>
                  <Text style={s.eduMeta}>
                    {[edu.institution, edu.year].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Select Date */}
          <View style={s.section}>
            <View style={s.dateHeader}>
              <View>
                <Text style={s.sectionTitle}>Select Date</Text>
                <Text style={s.sectionHint}>Only available dates are shown</Text>
              </View>
              <View style={s.monthNav}>
                <TouchableOpacity onPress={() => setMonthOffset(m => m - 1)} hitSlop={8}>
                  <Image source={IMG.chevron} style={[s.chevron, { transform: [{ scaleX: -1 }] }]} />
                </TouchableOpacity>
                <Text style={s.monthLabel}>{monthLabel}</Text>
                <TouchableOpacity onPress={() => setMonthOffset(m => m + 1)} hitSlop={8}>
                  <Image source={IMG.chevron} style={s.chevron} />
                </TouchableOpacity>
              </View>
            </View>
            {loading ? (
              <ActivityIndicator color={INK} style={{ marginVertical: 16 }} />
            ) : dateChips.length === 0 ? (
              <Text style={s.empty}>No available dates</Text>
            ) : (
              <View style={s.dateRow}>
                {dateChips.slice(0, 4).map(chip => {
                  const active = chip.isoDate === activeDate;
                  return (
                    <TouchableOpacity
                      key={chip.isoDate}
                      style={[s.dateChip, active ? s.dateChipActive : s.dateChipIdle]}
                      onPress={() => {
                        setSelectedDate(chip.isoDate);
                        setSelectedSlot(null);
                      }}
                    >
                      <Text style={[s.dateNum, !active && s.dateMuted]}>{chip.num}</Text>
                      <Text style={[s.dateDay, !active && s.dateMuted]} numberOfLines={1}>
                        {chip.weekday}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Select Time */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Select Time</Text>
            <Text style={s.sectionHint}>Only available times are shown</Text>
            {periods.map(period => {
              const ps = slotsForDate.filter(sl => getPeriod(sl.time) === period);
              if (!ps.length) return null;
              const periodActive = ps.some(sl => selectedSlot?._id === sl._id);
              return (
                <View key={period} style={s.periodBlock}>
                  <Text style={[s.periodLabel, !periodActive && selectedSlot && s.periodMuted]}>
                    {period}
                  </Text>
                  <View style={s.timeRow}>
                    {ps.map((slot: any) => {
                      const active = selectedSlot?._id === slot._id;
                      return (
                        <TouchableOpacity
                          key={slot._id}
                          style={[s.timeChip, active && s.timeChipActive, !active && selectedSlot && s.timeChipDim]}
                          onPress={() => setSelectedSlot(slot)}
                        >
                          <Text style={s.timeText}>{to12h(slot.time)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
            {!loading && slotsForDate.length === 0 && (
              <Text style={s.empty}>No slots for this date</Text>
            )}
          </View>

          {selectedSlot && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Describe your concerns</Text>
              <TextInput
                style={s.input}
                placeholder="What brings you in today?"
                placeholderTextColor="rgba(51,51,51,0.4)"
                value={complaints}
                onChangeText={setComplaints}
                multiline
              />
            </View>
          )}

          <TouchableOpacity
            style={[s.continueBtn, !selectedSlot && s.continueDisabled]}
            onPress={confirmBooking}
            disabled={!selectedSlot || booking}
            activeOpacity={0.85}
          >
            {booking ? (
              <ActivityIndicator color={INK} />
            ) : (
              <Text style={s.continueText}>
                {selectedSlot ? 'Continue to booking form' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },

  hero: {
    width: SW,
    height: 560 * SCALE,
    backgroundColor: '#f2f3f7',
    overflow: 'hidden',
  },
  heroImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SW,
    height: 560 * SCALE,
  },
  topBar: {
    position: 'absolute',
    left: H_PAD,
    right: H_PAD,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  circleBtn: {
    width: 36 * SCALE,
    height: 36 * SCALE,
    borderRadius: 18 * SCALE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { width: 16 * SCALE, height: 16 * SCALE },
  heartIcon: { width: 13 * SCALE, height: 13 * SCALE },

  ratingPill: {
    position: 'absolute',
    left: H_PAD,
    top: 194 * SCALE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5 * SCALE,
    paddingHorizontal: 11 * SCALE,
    paddingVertical: 5 * SCALE,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  ratingStar: { width: 12 * SCALE, height: 12 * SCALE },
  ratingText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 20 * SCALE,
    color: INK,
  },

  heroInfo: {
    position: 'absolute',
    left: H_PAD,
    top: 267 * SCALE,
    width: 140 * SCALE,
    gap: 4 * SCALE,
  },
  doctorName: {
    fontFamily: font('Medium'),
    fontSize: 24 * SCALE,
    fontWeight: '500',
    color: INK,
    lineHeight: 30 * SCALE,
  },
  degree: {
    fontFamily: font('Regular'),
    fontSize: 12 * SCALE,
    color: INK,
    marginTop: 8 * SCALE,
  },
  specialty: {
    fontFamily: font('Light'),
    fontSize: 8 * SCALE,
    color: INK,
  },

  availBadge: {
    position: 'absolute',
    left: H_PAD,
    top: 404 * SCALE,
    backgroundColor: ACCENT,
    borderRadius: 13,
    paddingHorizontal: 10 * SCALE,
    paddingVertical: 5 * SCALE,
  },
  availText: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: INK,
  },

  actionBar: {
    position: 'absolute',
    left: H_PAD,
    bottom: 40 * SCALE,
    width: CONTENT_W,
    borderRadius: 15,
    overflow: 'hidden',
    padding: 10 * SCALE,
  },
  actionBarTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(51,51,51,0.1)',
  },
  actionBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5 * SCALE,
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingHorizontal: 10 * SCALE,
    paddingVertical: 10 * SCALE,
    width: 115 * SCALE,
    justifyContent: 'center',
  },
  detailsText: {
    fontFamily: font('Light'),
    fontSize: 16 * SCALE,
    color: INK,
  },
  actionIcons: { flexDirection: 'row', gap: 5 * SCALE },
  iconCircle: {
    width: 38 * SCALE,
    height: 38 * SCALE,
    borderRadius: 19 * SCALE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: { width: 16 * SCALE, height: 16 * SCALE },

  statsCard: {
    marginTop: -34 * SCALE,
    marginHorizontal: H_PAD,
    width: CONTENT_W,
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingVertical: 20 * SCALE,
    paddingHorizontal: 10 * SCALE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20 * SCALE,
    zIndex: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 10 * SCALE },
  statIcon: { width: 24 * SCALE, height: 24 * SCALE },
  statVal: {
    fontFamily: font('Medium'),
    fontSize: 14 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  statLabel: {
    fontFamily: font('Light'),
    fontSize: 8 * SCALE,
    color: INK,
  },

  sheet: {
    marginTop: 20 * SCALE,
    paddingHorizontal: 26 * SCALE,
    gap: 28 * SCALE,
  },
  section: { gap: 8 * SCALE },
  sectionTitle: {
    fontFamily: font('Medium'),
    fontSize: 18 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  sectionHint: {
    fontFamily: font('Medium'),
    fontSize: 8 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.5)',
    marginBottom: 8 * SCALE,
  },

  hospitalList: { gap: 20 * SCALE, marginTop: 4 * SCALE },
  hospitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clinicMain: { flex: 1, paddingRight: 12 * SCALE, gap: 6 * SCALE },
  hospitalLogo: { width: 182 * SCALE, height: 40 * SCALE },
  hospitalLogoFallback: {
    width: 182 * SCALE,
    minHeight: 40 * SCALE,
    borderRadius: 10,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    paddingHorizontal: 10 * SCALE,
  },
  hospitalLogoFallbackText: {
    fontFamily: font('Medium'),
    fontSize: 12 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  clinicName: {
    fontFamily: font('Medium'),
    fontSize: 14 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  clinicBranch: {
    fontFamily: font('Light'),
    fontSize: 11 * SCALE,
    color: 'rgba(51,51,51,0.55)',
    marginTop: 2 * SCALE,
  },
  bioText: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    lineHeight: 20 * SCALE,
    color: 'rgba(51,51,51,0.75)',
    marginTop: 4 * SCALE,
  },
  eduRow: { marginTop: 6 * SCALE, gap: 2 * SCALE },
  eduDegree: {
    fontFamily: font('Medium'),
    fontSize: 13 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  eduMeta: {
    fontFamily: font('Light'),
    fontSize: 11 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
  radio: {
    width: 17 * SCALE,
    height: 17 * SCALE,
    borderRadius: 8.5 * SCALE,
    borderWidth: 1,
    borderColor: INK,
    opacity: 0.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { opacity: 1 },
  radioDot: {
    width: 11 * SCALE,
    height: 11 * SCALE,
    borderRadius: 6 * SCALE,
    backgroundColor: INK,
  },

  branchChip: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    padding: 10 * SCALE,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6 * SCALE,
    width: 255 * SCALE,
  },
  branchPin: { width: 9 * SCALE, height: 9 * SCALE, marginTop: 4 * SCALE, tintColor: '#e74c3c' },
  branchText: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: INK,
    flex: 1,
    lineHeight: 13 * SCALE,
  },
  mapWrap: {
    marginTop: 16 * SCALE,
    width: '100%',
    height: 333 * SCALE,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  mapPin: { width: 28 * SCALE, height: 28 * SCALE, zIndex: 1 },

  dateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 15 * SCALE, marginTop: 8 * SCALE },
  monthLabel: {
    fontFamily: font('Medium'),
    fontSize: 8 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  chevron: { width: 9 * SCALE, height: 9 * SCALE },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8 * SCALE,
  },
  dateChip: {
    width: 58 * SCALE,
    height: 56 * SCALE,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10 * SCALE,
  },
  dateChipActive: { backgroundColor: ACCENT },
  dateChipIdle: {
    borderWidth: 1,
    borderColor: 'rgba(51,51,51,0.5)',
    opacity: 0.5,
  },
  dateNum: {
    fontFamily: font('Medium'),
    fontSize: 18 * SCALE,
    fontWeight: '500',
    color: INK,
    textAlign: 'center',
  },
  dateDay: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: INK,
    textAlign: 'center',
  },
  dateMuted: { color: 'rgba(51,51,51,0.5)' },

  periodBlock: { gap: 10 * SCALE, marginTop: 8 * SCALE },
  periodLabel: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  periodMuted: { color: 'rgba(51,51,51,0.5)' },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 * SCALE },
  timeChip: {
    backgroundColor: ACCENT,
    borderRadius: 13,
    paddingHorizontal: 10 * SCALE,
    paddingVertical: 5 * SCALE,
  },
  timeChipActive: { opacity: 1 },
  timeChipDim: { opacity: 0.5 },
  timeText: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: INK,
  },

  input: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 14,
    padding: 12 * SCALE,
    fontFamily: font('Regular'),
    fontSize: 13 * SCALE,
    color: INK,
    minHeight: 72 * SCALE,
    textAlignVertical: 'top',
    marginTop: 4 * SCALE,
  },

  continueBtn: {
    marginTop: 8 * SCALE,
    marginBottom: 20 * SCALE,
    backgroundColor: ACCENT,
    borderRadius: 20,
    height: 44 * SCALE,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  continueDisabled: { opacity: 0.4 },
  continueText: {
    fontFamily: font('Light'),
    fontSize: 16 * SCALE,
    color: INK,
  },
  empty: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.5)',
    marginTop: 8 * SCALE,
  },
});
