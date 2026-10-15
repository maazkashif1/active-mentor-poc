import React, { useEffect, useState } from 'react';
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
  LogBox,
  Modal,
  Pressable,
} from 'react-native';

LogBox.ignoreAllLogs(true);
import { BlurView } from '@react-native-community/blur';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../../stores/appStore';

type Props = { navigation: NativeStackNavigationProp<any> };

// Figma frame 104:283 — 390 × 3083
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
  hero: require('../../assets/images/figma/hero.png'),
  howBg: require('../../assets/images/figma/how_bg.png'),
  ahmed: require('../../assets/images/figma/physio_ahmed.png'),
  sania: require('../../assets/images/figma/physio_sania.png'),
  knee: require('../../assets/images/figma/care_knee.png'),
  careShoulder: require('../../assets/images/figma/care_shoulder.png'),
  elbow: require('../../assets/images/figma/care_elbow.png'),
  mobility: require('../../assets/images/figma/care_mobility.png'),
  bell: require('../../assets/images/figma/icon_bell.png'),
  search: require('../../assets/images/figma/icon_search.png'),
  arrow: require('../../assets/images/figma/icon_arrow.png'),
  arrowCard: require('../../assets/images/figma/icon_arrow_card.png'),
  plus: require('../../assets/images/figma/icon_plus.png'),
  home: require('../../assets/images/figma/icon_home.png'),
  tabSearch: require('../../assets/images/figma/icon_tab_search.png'),
  analytics: require('../../assets/images/figma/icon_analytics.png'),
  history: require('../../assets/images/figma/icon_history.png'),
  profile: require('../../assets/images/figma/icon_profile.png'),
  joints: require('../../assets/images/figma/icon_joints.png'),
  shoulder: require('../../assets/images/figma/icon_shoulder.png'),
  star: require('../../assets/images/figma/icon_star_frame.png'),
};

// Figma hero image crop: h 129.78%, top -29.67% inside 534pt frame
const HERO_H = 534 * SCALE;
const HERO_IMG_H = HERO_H * 1.2978;
const HERO_IMG_TOP = -HERO_H * 0.2967;

const PLACEHOLDERS = [IMG.ahmed, IMG.sania];
const CHIPS = ['Knee Rehab', 'Nearest', 'Available Today', 'Shoulder Expert'];

const BODY_JOINTS = [
  {
    id: 'knee',
    label: 'Knee',
    filter: 'Knee Rehab',
    tip: 'Ease swelling with short, frequent movement. Avoid deep squats until cleared.',
    image: IMG.knee,
  },
  {
    id: 'shoulder',
    label: 'Shoulder',
    filter: 'Shoulder Expert',
    tip: 'Keep the elbow below shoulder height early on. Gentle pendulum swings help.',
    image: IMG.careShoulder,
  },
  {
    id: 'elbow',
    label: 'Elbow',
    filter: 'Elbow Care',
    tip: 'Limit gripping and heavy lifts. Easy flexion–extension keeps your range.',
    image: IMG.elbow,
  },
  {
    id: 'mobility',
    label: 'Mobility',
    filter: 'Mobility Care',
    tip: 'Ten quiet minutes of joint circles beats one hard session. Breathe with each rep.',
    image: IMG.mobility,
  },
];

const STORY_CHAPTERS = [
  {
    id: 'intake',
    label: 'Intake',
    title: 'Tell us where it hurts',
    body: 'A short form so care matches this visit — knee today, shoulder next time.',
  },
  {
    id: 'matched',
    label: 'Matched',
    title: 'Find your physiotherapist',
    body: 'Browse specialists by need, distance, and availability.',
  },
  {
    id: 'booked',
    label: 'Booked',
    title: 'Confirm your assessment',
    body: 'Pick a clinic, date, and time that works for you.',
  },
  {
    id: 'plan',
    label: 'Plan',
    title: 'Start your care plan',
    body: 'Daily mobility and guided exercises between sessions.',
  },
  {
    id: 'progress',
    label: 'Progress',
    title: 'Track how you recover',
    body: 'Prescriptions, history, and what to do next.',
  },
];

const DEMO_MATCHED = [
  { name: 'Dr. Ahmed Khan', specialty: 'Knee Specialist • Sports Injury', dist: '2.4 km away' },
  { name: 'Dr. Ahmed Khan', specialty: 'Knee Specialist • Sports Injury', dist: '2.4 km away' },
];

const DEMO_NEARBY = [
  { name: 'Dr. Sania Ali', specialty: 'Musculoskeletal Physiotherapist', dist: '1.2 km away' },
  { name: 'Dr. Ahmed Khan', specialty: 'Knee Specialist • Sports Injury', dist: '0.8 km away' },
];

function greetingForHour(h: number) {
  if (h < 5) return "Hey, it's late —";
  if (h < 12) return 'Good Morning,';
  if (h < 17) return 'Good Afternoon,';
  if (h < 22) return 'Good Evening,';
  return "Hey, it's late —";
}

function sessionDateKey(session: any) {
  return String(session?.slotDate || session?.date || '').slice(0, 10);
}

function isPastSession(session: any, today = todayKey()) {
  const d = sessionDateKey(session);
  if (!d) return false;
  if (session?.status === 'missed') return true;
  return d < today;
}

function isUpcomingSession(session: any, today = todayKey()) {
  const d = sessionDateKey(session);
  if (!d || d < today) return false;
  if (session?.status === 'missed') return false;
  return true;
}

/** Next booking pill — never says “yesterday”; past slots become miss + reschedule. */
function sessionPillState(sessions: any[]): {
  text: string;
  missed: boolean;
  session: any | null;
} {
  const today = todayKey();
  const upcoming = sessions.find(s => isUpcomingSession(s, today));
  if (upcoming) {
    const raw = sessionDateKey(upcoming);
    const time = upcoming.slotTime || upcoming.time;
    let dayLabel = 'Upcoming';
    if (raw) {
      const d = new Date(`${raw}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        const startToday = new Date();
        startToday.setHours(12, 0, 0, 0);
        const startSession = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
        const diffDays = Math.round((startSession.getTime() - startToday.getTime()) / 86400000);
        if (diffDays === 0) dayLabel = 'Today';
        else if (diffDays === 1) dayLabel = 'Tomorrow';
        else {
          dayLabel = d.toLocaleDateString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });
        }
      }
    }
    return {
      text: time ? `Next session · ${dayLabel} ${time}` : `Next session · ${dayLabel}`,
      missed: false,
      session: upcoming,
    };
  }

  const past = [...sessions]
    .filter(s => isPastSession(s, today))
    .sort((a, b) => sessionDateKey(b).localeCompare(sessionDateKey(a)));
  const missed = past.find(
    s =>
      s.status === 'missed' ||
      s.status === 'pending' ||
      s.status === 'active' ||
      !['approved', 'summarised'].includes(s.status || ''),
  );

  if (missed) {
    return {
      text: 'You missed your appointment · Reschedule',
      missed: true,
      session: missed,
    };
  }

  return { text: 'No session booked', missed: false, session: null };
}

function dayKey(d: Date | string) {
  const x = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return '';
  return x.toISOString().slice(0, 10);
}

function todayKey() {
  return dayKey(new Date());
}

/** Estimate session length from target reps (camera + rest). */
function mobilityMinutes(targetReps?: number) {
  return Math.min(15, Math.max(8, Math.round((targetReps || 12) * 0.75)));
}

function activityDates(progress: any[]): Set<string> {
  const dates = new Set<string>();
  for (const p of progress || []) {
    for (const t of p.trend || []) {
      const k = dayKey(t.date);
      if (k) dates.add(k);
    }
  }
  return dates;
}

function computeStreak(progress: any[]): number {
  const dates = activityDates(progress);
  if (!dates.size) return 0;
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  // If nothing today, allow streak to start from yesterday
  if (!dates.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const k = dayKey(cursor);
    if (!dates.has(k)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function mobilityPillLabel(progress: any[], prescriptions: any[]): string {
  const dates = activityDates(progress);
  if (dates.has(todayKey())) return 'Mobility done today';
  const primary = prescriptions[0];
  const fromProgress = progress[0];
  const mins = mobilityMinutes(primary?.targetReps ?? fromProgress?.targetReps);
  if (prescriptions.length || progress.length) return `${mins} min mobility due`;
  return `${mins} min starter mobility`;
}

function ArrowBtn({ size = 25 }: { size?: number }) {
  return (
    <View style={[s.arrowBtn, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={IMG.arrowCard} style={{ width: size * 0.42, height: size * 0.42 }} resizeMode="contain" />
    </View>
  );
}

function PhysioCard({
  name,
  specialty,
  dist,
  photo,
  onPress,
}: {
  name: string;
  specialty: string;
  dist: string;
  photo: any;
  onPress: () => void;
}) {
  const w = 212 * SCALE;
  const h = 211 * SCALE;
  return (
    <TouchableOpacity style={[s.physioCard, { width: w, height: h }]} onPress={onPress} activeOpacity={0.9}>
      <Image source={photo} style={{ width: w, height: h, borderRadius: 13 }} resizeMode="cover" />
      <View style={s.physioGlassWrap}>
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="light"
          blurAmount={18}
          reducedTransparencyFallbackColor="rgba(255,255,255,0.85)"
        />
        <View style={s.physioGlassInner}>
          <View style={{ flex: 1 }}>
            <Text style={s.physioName} numberOfLines={1}>{name}</Text>
            <Text style={s.physioSpecialty} numberOfLines={1}>{specialty}</Text>
            <View style={s.physioMeta}>
              <View style={s.badgeRow}>
                <Image source={IMG.star} style={s.badgeIcon} />
                <View style={s.badgePill}>
                  <Image source={IMG.joints} style={s.badgeTiny} />
                </View>
                <View style={s.badgePill}>
                  <Image source={IMG.shoulder} style={s.badgeTiny} />
                </View>
              </View>
              <Text style={s.physioDist}>{dist}</Text>
            </View>
          </View>
          <ArrowBtn />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({
  titleNode,
  sub,
  onSeeMore,
  light,
  seeMoreLower,
}: {
  titleNode: React.ReactNode;
  sub: string;
  onSeeMore: () => void;
  light?: boolean;
  seeMoreLower?: boolean;
}) {
  return (
    <View style={[s.sectionHeader, seeMoreLower && s.howHeader]}>
      <View style={[s.sectionTitleBlock, seeMoreLower && { gap: 5 * SCALE }]}>
        <Text style={[s.sectionTitle, light && { color: '#fff' }]}>{titleNode}</Text>
        <Text style={[s.sectionSub, light && { color: '#fff' }]}>{sub}</Text>
      </View>
      <TouchableOpacity
        style={[s.seeMoreBtn, light && { opacity: 1 }]}
        onPress={onSeeMore}
      >
        <Text style={[s.seeMoreText, light && { color: '#fff', opacity: 1 }]}>See More</Text>
        <Image
          source={IMG.arrow}
          style={[s.seeMoreArrow, light && { tintColor: '#fff' }]}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
}

export default function NewHomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [careArea, setCareArea] = useState('');
  const [activeTab, setActiveTab] = useState('Home');
  const [greet, setGreet] = useState(() => greetingForHour(new Date().getHours()));
  const [bodyJoint, setBodyJoint] = useState<(typeof BODY_JOINTS)[0] | null>(null);
  const [storyFocus, setStoryFocus] = useState<string | null>(null);
  const physios = useAppStore(s => s.physios);
  const sessions = useAppStore(s => s.sessions);
  const prescriptions = useAppStore(s => s.prescriptions);
  const progress = useAppStore(s => s.progress);
  const fetchPhysios = useAppStore(s => s.fetchPhysios);
  const fetchSessions = useAppStore(s => s.fetchSessions);
  const fetchPrescriptions = useAppStore(s => s.fetchPrescriptions);
  const fetchProgress = useAppStore(s => s.fetchProgress);

  useEffect(() => {
    AsyncStorage.getItem('userProfile').then(v => {
      if (v) {
        const p = JSON.parse(v);
        setFirstName(p.firstName || '');
        setCareArea(p.careArea || '');
      }
    });
    if (!physios.length) fetchPhysios();
    fetchSessions();
    fetchPrescriptions();
    fetchProgress();
    const tick = () => setGreet(greetingForHour(new Date().getHours()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const goToFind = (filter?: string) => {
    navigation.navigate('Booking' as any, filter ? { filter } : undefined);
  };

  const goToDoctor = (physio: any, localPhoto?: any) => {
    navigation.navigate('DoctorProfile' as any, {
      physio: { ...physio, localPhoto: localPhoto || physio.localPhoto },
    });
  };

  const goToExercises = () => {
    if (prescriptions[0]) {
      navigation.navigate('ExerciseMenu' as any, { prescription: prescriptions[0] });
    } else {
      navigation.navigate('ExerciseMenu' as any);
    }
  };

  const sessionPill = sessionPillState(sessions);
  const upcoming = sessionPill.session && !sessionPill.missed ? sessionPill.session : null;
  const hasCare = sessions.length > 0 || prescriptions.length > 0;
  const streak = computeStreak(progress);
  const mobilityDoneToday = activityDates(progress).has(todayKey());
  const mobilityPill = mobilityPillLabel(progress, prescriptions);
  const unreadPlans = prescriptions.filter((p: any) => {
    const prog = progress.find((x: any) => String(x.prescriptionId) === String(p._id));
    return !prog || !prog.totalSessions;
  }).length;
  const carePhysio =
    upcoming?.physiologistId ||
    sessions.find((s: any) => s.physiologistId)?.physiologistId ||
    null;
  const planDay = Math.min(
    14,
    Math.max(1, (streak || 0) + (careArea ? 1 : 0) + (hasCare ? 1 : 0)),
  );

  const chapterDone: Record<string, boolean> = {
    intake: !!careArea,
    matched: physios.length > 0 || hasCare,
    booked: sessions.length > 0,
    plan: prescriptions.length > 0 || mobilityDoneToday,
    progress: progress.some((p: any) => (p.totalSessions || 0) > 0) ||
      sessions.some((s: any) => s.status === 'approved' || s.status === 'summarised'),
  };
  const activeChapterId =
    storyFocus ||
    STORY_CHAPTERS.find(c => !chapterDone[c.id])?.id ||
    'progress';
  const activeChapter = STORY_CHAPTERS.find(c => c.id === activeChapterId) || STORY_CHAPTERS[0];

  const runChapter = (id: string) => {
    if (id === 'intake') navigation.navigate('CareArea' as any, { returnTo: 'NewHome' });
    else if (id === 'matched') goToFind();
    else if (id === 'booked') (sessions.length ? navigation.navigate('ConsultHistory' as any) : goToFind());
    else if (id === 'plan') goToExercises();
    else navigation.navigate('Prescriptions' as any);
  };

  const messagePhysio = () => {
    const openChat = (physio: any) => {
      const id = physio?._id || physio?.id;
      if (!id) return false;
      navigation.navigate('Chat' as any, {
        physiologistId: String(id),
        physioName: physio.name || 'Physiotherapist',
      });
      return true;
    };

    if (carePhysio && typeof carePhysio === 'object' && openChat(carePhysio)) return;
    if (carePhysio) {
      const fromList = physios.find((p: any) => String(p._id) === String(carePhysio));
      if (fromList && openChat(fromList)) return;
    }
    if (physios[0] && openChat(physios[0])) return;
    navigation.navigate('Booking' as any);
  };

  const displayName = firstName || 'Maaz';
  const initial = (displayName[0] || 'M').toUpperCase();
  // Figma: status 44 + 21 = content top 65; CTA at contentTop + 301 + 51 = 417
  const heroContentTop = Math.max(insets.top, 44 * SCALE) + 21 * SCALE;
  const heroCtaTop = heroContentTop + 301 * SCALE + 51 * SCALE;

  const matched = (physios.length
    ? physios.slice(0, 4).map((p, i) => ({
        ...p,
        name: p.name,
        specialty: p.specialty || p.specialization || 'Physiotherapist',
        dist: `${(2.4 - i * 0.4).toFixed(1)} km away`,
        cardPhoto: PLACEHOLDERS[i % 2],
      }))
    : DEMO_MATCHED.map((d, i) => ({
        ...d,
        specialty: d.specialty,
        cardPhoto: PLACEHOLDERS[i % 2],
        localPhoto: PLACEHOLDERS[i % 2],
      })));

  const nearby = (physios.length
    ? [...physios].reverse().slice(0, 4).map((p, i) => ({
        ...p,
        name: p.name,
        specialty: p.specialty || p.specialization || 'Physiotherapist',
        dist: `${(1.2 - i * 0.2).toFixed(1)} km away`,
        cardPhoto: PLACEHOLDERS[(i + 1) % 2],
      }))
    : DEMO_NEARBY.map((d, i) => ({
        ...d,
        specialty: d.specialty,
        cardPhoto: PLACEHOLDERS[(i + 1) % 2],
        localPhoto: PLACEHOLDERS[(i + 1) % 2],
      })));

  const TABS: { label: string; icon: any; action?: () => void; screen?: string }[] = [
    { label: 'Home', icon: IMG.home },
    { label: 'Search', icon: IMG.tabSearch, action: () => goToFind() },
    { label: 'Analytics', icon: IMG.analytics, screen: 'Prescriptions' },
    { label: 'History', icon: IMG.history, screen: 'ConsultHistory' },
    { label: 'Profile', icon: IMG.profile, screen: 'Profile' },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero — Figma 104:607 h=534; content 104:617 at y=65 (342×301); CTA 104:647 at y=417 (342×44) */}
        <View style={[s.hero, { height: HERO_H }]}>
          <Image
            source={IMG.hero}
            style={{
              position: 'absolute',
              left: 0,
              width: SW,
              height: HERO_IMG_H,
              top: HERO_IMG_TOP,
            }}
            resizeMode="cover"
          />
          <View style={s.heroOverlay} />

          {/* Frame 104:617 — gap 30 between icons and Hello block */}
          <View style={[s.heroInner, { top: heroContentTop }]}>
            <View style={s.heroTopRow}>
              <View style={s.topCircle}>
                <Text style={s.topInitial}>{initial}</Text>
              </View>
              <View style={s.topCircle}>
                <Image source={IMG.bell} style={s.bellIcon} resizeMode="contain" />
                <View style={s.bellDot} />
              </View>
            </View>

            {/* Frame 104:627 — gap 20 between Hello and lower block */}
            <View style={s.heroBody}>
              <Text style={s.hello} numberOfLines={1}>
                <Text style={s.helloLight}>Hello, </Text>
                <Text style={s.helloBold}>{displayName}!</Text>
              </Text>

              {/* Frame 104:629 — gap 51 between greeting and search */}
              <View style={s.heroLower}>
                <View style={s.heroSubBlock}>
                  <Text style={s.greet}>{greet}</Text>
                  <Text style={s.headline}>
                    Let's find the right physiotherapist for you.
                  </Text>
                </View>

                <View style={s.searchSection}>
                  <TouchableOpacity onPress={() => goToFind()} activeOpacity={0.9}>
                    <View style={s.searchBar}>
                      <BlurView
                        style={StyleSheet.absoluteFill}
                        blurType="light"
                        blurAmount={12}
                        reducedTransparencyFallbackColor="rgba(255,255,255,0.1)"
                      />
                      <View style={s.searchBarTint} />
                      <Image source={IMG.search} style={s.searchIcon} resizeMode="contain" />
                      <Text style={s.searchPlaceholder} numberOfLines={1}>
                        Search physiotherapist, clinic, or area...
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View style={s.chipRow}>
                    {CHIPS.map(chip => (
                      <TouchableOpacity
                        key={chip}
                        style={s.chip}
                        onPress={() => goToFind(chip)}
                        activeOpacity={0.85}
                      >
                        <BlurView
                          style={StyleSheet.absoluteFill}
                          blurType="light"
                          blurAmount={12}
                          reducedTransparencyFallbackColor="rgba(255,255,255,0.1)"
                        />
                        <Text style={s.chipText} numberOfLines={1}>{chip}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Find stays the hero CTA */}
          <TouchableOpacity
            style={[s.findBtn, { top: heroCtaTop }]}
            onPress={() => goToFind()}
            activeOpacity={0.85}
          >
            <Text style={s.findBtnText}>Find a Physiotherapist</Text>
          </TouchableOpacity>

          <LinearGradient colors={['rgba(255,255,255,0)', '#fff']} style={s.heroFade} pointerEvents="none" />
        </View>

        {/* A + B · Care Today brief + Find | Continue fork */}
        <View style={s.careToday}>
          <Text style={s.careTodayEyebrow}>Care Today</Text>
          <Text style={s.careTodayTitle}>
            {hasCare ? 'Your body, this morning' : 'Start your recovery'}
          </Text>
          <Text style={s.careTodaySub}>
            {careArea
              ? `${careArea} plan · Day ${planDay} of 14`
              : hasCare
                ? 'Exercises and sessions live here — not only booking.'
                : 'Two paths: find a specialist, or start moving today.'}
          </Text>

          <View style={s.pillRow}>
            <TouchableOpacity
              style={[s.pill, sessionPill.missed ? s.pillMissed : s.pillAccent]}
              onPress={() =>
                sessionPill.missed
                  ? goToFind()
                  : sessionPill.session
                    ? navigation.navigate('SessionDetail' as any, { session: sessionPill.session })
                    : goToFind()
              }
              activeOpacity={0.85}
            >
              <Text style={s.pillText}>{sessionPill.text}</Text>
            </TouchableOpacity>
            <View style={[s.pill, mobilityDoneToday && s.pillAccent]}>
              <Text style={s.pillText}>{mobilityPill}</Text>
            </View>
            {streak > 0 ? (
              <View style={s.pill}>
                <Text style={s.pillText}>
                  {streak}-day streak
                </Text>
              </View>
            ) : null}
            {unreadPlans > 0 ? (
              <View style={s.pill}>
                <Text style={s.pillText}>
                  {unreadPlans} new plan{unreadPlans === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}
          </View>

          {/* B · equal half-panels */}
          <View style={s.forkRow}>
            <TouchableOpacity
              style={[s.forkPanel, s.forkContinue]}
              onPress={() =>
                hasCare
                  ? navigation.navigate('ConsultHistory' as any)
                  : goToExercises()
              }
              activeOpacity={0.88}
            >
              <Text style={s.forkTag}>Continue</Text>
              <Text style={s.forkTitle}>
                {hasCare ? 'Your care' : 'Self-care'}
              </Text>
              <Text style={s.forkBody}>
                {hasCare
                  ? streak > 0
                    ? `${streak}-day streak · sessions & plans`
                    : 'Sessions, history & prescriptions'
                  : 'Browse starter mobility'}
              </Text>
              <Text style={s.forkCta}>
                {hasCare ? 'Open history →' : 'Start moving →'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.forkPanel, s.forkFind]}
              onPress={() => goToFind()}
              activeOpacity={0.88}
            >
              <Text style={s.forkTag}>Find</Text>
              <Text style={s.forkTitle}>Book care</Text>
              <Text style={s.forkBody}>
                {hasCare
                  ? 'Another specialist near you'
                  : 'Match by need, distance, availability'}
              </Text>
              <Text style={s.forkCta}>Browse physios →</Text>
            </TouchableOpacity>
          </View>

          {/* Deeper companion links */}
          <View style={s.companionRow}>
            <TouchableOpacity style={s.companionChip} onPress={goToExercises} activeOpacity={0.85}>
              <Text style={s.companionChipText}>
                {mobilityDoneToday ? 'Review plan' : 'Do mobility'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.companionChip}
              onPress={() => navigation.navigate('Prescriptions' as any)}
              activeOpacity={0.85}
            >
              <Text style={s.companionChipText}>
                {unreadPlans > 0 ? `${unreadPlans} unread plans` : 'Prescriptions'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.companionChip} onPress={messagePhysio} activeOpacity={0.85}>
              <Text style={s.companionChipText}>Message physio</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Matched / care team */}
        <View style={s.section}>
          <SectionHeader
            titleNode={
              hasCare ? (
                <>
                  <Text style={s.titleMed}>Your </Text>
                  <Text style={s.titleLight}>care team</Text>
                </>
              ) : (
                <>
                  <Text style={s.titleMed}>Matched</Text>
                  <Text style={s.titleLight}> to your needs</Text>
                </>
              )
            }
            sub={
              hasCare
                ? 'Physiotherapists linked to your recovery.'
                : 'Based on your selected concern and preferences.'
            }
            onSeeMore={() => goToFind('Knee Rehab')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.physioList}>
            {matched.map((p, i) => (
              <PhysioCard
                key={`m-${p._id || i}`}
                name={p.name}
                specialty={p.specialty}
                dist={p.dist}
                photo={p.cardPhoto}
                onPress={() => goToDoctor(p, p.cardPhoto)}
              />
            ))}
          </ScrollView>
        </View>

        {/* D · Body map — where it hurts → care sheet */}
        <View style={s.section}>
          <SectionHeader
            titleNode={
              <>
                <Text style={s.titleLight}>Where </Text>
                <Text style={s.titleMed}>it hurts</Text>
              </>
            }
            sub="Tap a joint for a tip, then see specialists if you need one."
            onSeeMore={() => goToFind()}
          />
          <View style={s.bodyHotspots}>
            {BODY_JOINTS.map(j => (
              <TouchableOpacity
                key={j.id}
                style={s.bodyHotspot}
                onPress={() => setBodyJoint(j)}
                activeOpacity={0.85}
              >
                <Image source={j.image} style={s.bodyHotspotImg} resizeMode="cover" />
                <View style={s.bodyHotspotDim} />
                <Text style={s.bodyHotspotLabel}>{j.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Near you */}
        <View style={[s.section, s.nearSection]}>
          <SectionHeader
            titleNode={
              <>
                <Text style={s.titleMed}>Physiotherapists </Text>
                <Text style={s.titleLight}>near you</Text>
              </>
            }
            sub="Discover trusted physiotherapists nearby and find the right care for your needs."
            onSeeMore={() => goToFind('Nearest')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.physioList}>
            {nearby.map((p, i) => (
              <PhysioCard
                key={`n-${p._id || i}`}
                name={p.name}
                specialty={p.specialty}
                dist={p.dist}
                photo={p.cardPhoto}
                onPress={() => goToDoctor(p, p.cardPhoto)}
              />
            ))}
          </ScrollView>
        </View>

        {/* C · Story reel — recovery chapters (replaces How We Work) */}
        <View style={s.howSection}>
          <Image source={IMG.howBg} style={s.howBgImage} resizeMode="cover" pointerEvents="none" />
          <View style={s.howOverlay} pointerEvents="none" />
          <LinearGradient
            colors={['#FFFFFF', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']}
            locations={[0, 0.4, 1]}
            style={s.howFade}
            pointerEvents="none"
          />
          <View style={[s.howContent, { paddingBottom: 100 * SCALE + Math.max(insets.bottom, 8) }]}>
            <SectionHeader
              titleNode={
                <>
                  <Text style={s.titleLight}>Your </Text>
                  <Text style={s.titleMed}>recovery</Text>
                </>
              }
              sub="Chapters you own — tap one to jump ahead."
              onSeeMore={() => runChapter(activeChapter.id)}
              light
              seeMoreLower
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.storyStrip}
            >
              {STORY_CHAPTERS.map((ch, i) => {
                const done = chapterDone[ch.id];
                const active = ch.id === activeChapter.id;
                return (
                  <TouchableOpacity
                    key={ch.id}
                    style={[s.storyChip, active && s.storyChipActive, done && !active && s.storyChipDone]}
                    onPress={() => setStoryFocus(ch.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.storyChipNum, active && s.storyChipNumActive]}>
                      {String(i + 1).padStart(2, '0')}
                    </Text>
                    <Text style={[s.storyChipLabel, active && s.storyChipLabelActive]}>
                      {ch.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={s.storyCard}
              onPress={() => runChapter(activeChapter.id)}
              activeOpacity={0.88}
            >
              <BlurView
                style={StyleSheet.absoluteFill}
                blurType="light"
                blurAmount={7}
                reducedTransparencyFallbackColor="rgba(51,51,51,0.15)"
                pointerEvents="none"
              />
              <View style={s.howCardGlassTint} pointerEvents="none" />
              <Text style={s.storyCardEyebrow}>
                {chapterDone[activeChapter.id] ? 'Complete' : 'Up next'}
              </Text>
              <Text style={s.storyCardTitle}>{activeChapter.title}</Text>
              <Text style={s.storyCardBody}>{activeChapter.body}</Text>
              <View style={s.storyCardCta}>
                <Text style={s.storyCardCtaText}>
                  {activeChapter.id === 'matched' || (!hasCare && activeChapter.id === 'booked')
                    ? 'Find a physiotherapist'
                    : activeChapter.id === 'intake'
                      ? 'Update intake'
                      : activeChapter.id === 'plan'
                        ? "Open today's plan"
                        : activeChapter.id === 'progress'
                          ? 'View prescriptions'
                          : 'Open sessions'}
                </Text>
                <Image source={IMG.plus} style={{ width: 12, height: 12 }} resizeMode="contain" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* D · Care sheet for tapped joint */}
      <Modal
        visible={!!bodyJoint}
        transparent
        animationType="slide"
        onRequestClose={() => setBodyJoint(null)}
      >
        <Pressable style={s.sheetScrim} onPress={() => setBodyJoint(null)}>
          <Pressable style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]} onPress={e => e.stopPropagation()}>
            {bodyJoint ? (
              <>
                <View style={s.sheetHandle} />
                <Image source={bodyJoint.image} style={s.sheetHero} resizeMode="cover" />
                <Text style={s.sheetTitle}>{bodyJoint.label}</Text>
                <Text style={s.sheetTip}>{bodyJoint.tip}</Text>
                <TouchableOpacity
                  style={s.sheetPrimary}
                  onPress={() => {
                    setBodyJoint(null);
                    navigation.navigate('ExerciseMenu' as any);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={s.sheetPrimaryText}>Try a gentle exercise</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.sheetSecondary}
                  onPress={() => {
                    const filter = bodyJoint.filter;
                    setBodyJoint(null);
                    goToFind(filter);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={s.sheetSecondaryText}>See specialists</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Tab bar — Figma #e0e7ef pill */}
      <View style={[s.tabBar, { bottom: Math.max(insets.bottom, 12) }]}>
        {TABS.map(item => {
          const active = activeTab === item.label;
          return (
            <TouchableOpacity
              key={item.label}
              style={s.tabItem}
              onPress={() => {
                setActiveTab(item.label);
                if (item.action) item.action();
                else if (item.screen) navigation.navigate(item.screen as any);
              }}
            >
              <Image
                source={item.icon}
                style={[s.tabIcon, { opacity: active ? 1 : 0.55 }]}
                resizeMode="contain"
              />
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 0 },

  hero: { width: SW, overflow: 'hidden' },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  // Frame 104:617 — 342×301, gap 30
  heroInner: {
    position: 'absolute',
    left: H_PAD,
    width: CONTENT_W,
    height: 301 * SCALE,
    gap: 30 * SCALE,
    zIndex: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    height: 23 * SCALE,
  },
  topCircle: {
    width: 23 * SCALE,
    height: 23 * SCALE,
    borderRadius: 12 * SCALE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topInitial: {
    fontFamily: font('SemiBold'),
    fontSize: 8.05 * SCALE,
    color: INK,
    fontWeight: '600',
  },
  bellIcon: { width: 10.35 * SCALE, height: 10.35 * SCALE },
  bellDot: {
    position: 'absolute',
    top: 4.89 * SCALE,
    right: 5.75 * SCALE,
    width: 2.875 * SCALE,
    height: 2.875 * SCALE,
    borderRadius: 2,
    backgroundColor: INK,
  },
  // Frame 104:627 — gap 20
  heroBody: {
    width: '100%',
    gap: 20 * SCALE,
  },
  hello: {
    color: '#fff',
    height: 40 * SCALE,
  },
  helloLight: {
    fontFamily: font('Light'),
    fontSize: 36 * SCALE,
    fontWeight: '300',
    color: '#fff',
  },
  helloBold: {
    fontFamily: font('SemiBold'),
    fontSize: 36 * SCALE,
    fontWeight: '600',
    color: '#fff',
  },
  // Frame 104:629 — gap 51
  heroLower: {
    width: '100%',
    gap: 51 * SCALE,
  },
  heroSubBlock: {
    width: '100%',
  },
  greet: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 20 * SCALE,
    fontWeight: '300',
    color: '#fff',
  },
  // Figma 104:632 — 24px / leading 25px / height 50 (2 lines)
  headline: {
    fontFamily: font('Medium'),
    fontSize: 24 * SCALE,
    lineHeight: 25 * SCALE,
    fontWeight: '500',
    color: '#fff',
  },
  searchSection: {
    width: CONTENT_W,
    gap: 10 * SCALE,
    alignItems: 'center',
  },
  // Figma 104:634 — h=35, radius=20, fill #FFFFFF @ 10% + backdrop blur
  searchBar: {
    width: CONTENT_W,
    height: 35 * SCALE,
    borderRadius: 20 * SCALE,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17 * SCALE,
    gap: 10 * SCALE,
  },
  searchBarTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: { width: 9.5 * SCALE, height: 9.5 * SCALE, tintColor: '#fff' },
  searchPlaceholder: {
    fontFamily: font('Light'),
    fontSize: 10 * SCALE,
    fontWeight: '300',
    color: '#fff',
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10 * SCALE,
  },
  chip: {
    padding: 5 * SCALE,
    borderRadius: 20 * SCALE,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipText: {
    fontFamily: font('Light'),
    fontSize: 8 * SCALE,
    lineHeight: 12 * SCALE,
    fontWeight: '300',
    color: '#fff',
  },
  // Frame 104:647 — 342×44, p=10, radius 20
  findBtn: {
    position: 'absolute',
    left: H_PAD,
    width: CONTENT_W,
    height: 44 * SCALE,
    backgroundColor: ACCENT,
    borderRadius: 20 * SCALE,
    padding: 10 * SCALE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  findBtnText: {
    fontFamily: font('Light'),
    fontSize: 16 * SCALE,
    fontWeight: '300',
    color: INK,
  },
  // Figma 104:649 — white blur strip at y=523, h=22
  heroFade: {
    position: 'absolute',
    left: -8 * SCALE,
    width: 405 * SCALE,
    bottom: 0,
    height: 72 * SCALE,
  },

  careToday: {
    paddingHorizontal: H_PAD,
    paddingTop: 36 * SCALE,
    paddingBottom: 8 * SCALE,
    gap: 12 * SCALE,
    backgroundColor: '#fff',
  },
  careTodayEyebrow: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  careTodayTitle: {
    fontFamily: font('Medium'),
    fontSize: 28 * SCALE,
    fontWeight: '500',
    color: INK,
    lineHeight: 34 * SCALE,
  },
  careTodaySub: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    lineHeight: 19 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8 * SCALE,
  },
  pill: {
    backgroundColor: '#f3f5f8',
    borderRadius: 20,
    paddingHorizontal: 12 * SCALE,
    paddingVertical: 7 * SCALE,
  },
  pillAccent: {
    backgroundColor: ACCENT,
  },
  pillMissed: {
    backgroundColor: '#ebe4e4',
  },
  pillText: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: INK,
  },
  forkRow: {
    flexDirection: 'row',
    gap: 10 * SCALE,
    marginTop: 4 * SCALE,
  },
  forkPanel: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 18 * SCALE,
    paddingHorizontal: 14 * SCALE,
    minHeight: 168 * SCALE,
    justifyContent: 'space-between',
    gap: 8 * SCALE,
  },
  forkContinue: {
    backgroundColor: ACCENT,
  },
  forkFind: {
    backgroundColor: '#f7f8fb',
  },
  forkTag: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  forkTitle: {
    fontFamily: font('Medium'),
    fontSize: 20 * SCALE,
    fontWeight: '500',
    color: INK,
    lineHeight: 24 * SCALE,
  },
  forkBody: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    lineHeight: 17 * SCALE,
    color: 'rgba(51,51,51,0.55)',
    flexGrow: 1,
  },
  forkCta: {
    fontFamily: font('Medium'),
    fontSize: 12 * SCALE,
    fontWeight: '500',
    color: INK,
    marginTop: 4 * SCALE,
  },
  companionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8 * SCALE,
    marginTop: 4 * SCALE,
  },
  companionChip: {
    backgroundColor: '#f3f5f8',
    borderRadius: 20,
    paddingHorizontal: 12 * SCALE,
    paddingVertical: 9 * SCALE,
  },
  companionChipText: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.6)',
  },

  // First content at y=606 → 72pt after hero (534)
  section: {
    paddingHorizontal: H_PAD,
    paddingTop: 72 * SCALE,
    gap: 50 * SCALE,
    backgroundColor: '#fff',
  },
  // Extra bottom pad so physio cards aren't clipped by the how-we-work fade
  nearSection: {
    paddingBottom: 28 * SCALE,
    overflow: 'visible',
  },
  sectionHeader: { gap: 25 * SCALE, width: CONTENT_W },
  sectionTitleBlock: { gap: 5 * SCALE },
  sectionTitle: {
    fontSize: 36 * SCALE,
    lineHeight: 38 * SCALE,
    color: INK,
  },
  titleLight: {
    fontFamily: font('Light'),
    fontWeight: '300',
  },
  titleMed: {
    fontFamily: font('Medium'),
    fontWeight: '500',
  },
  sectionSub: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 20 * SCALE,
    fontWeight: '300',
    color: INK,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 5 * SCALE,
    opacity: 0.5,
  },
  seeMoreText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 20 * SCALE,
    fontWeight: '300',
    color: INK,
  },
  seeMoreArrow: {
    width: 14 * SCALE,
    height: 14 * SCALE,
    transform: [{ rotate: '-90deg' }],
    tintColor: INK,
  },

  // Figma card gap: 239.63 − 211.63 ≈ 28
  physioList: { gap: 28 * SCALE, paddingRight: H_PAD },
  physioCard: {
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#ddd',
  },
  physioGlassWrap: {
    position: 'absolute',
    left: 8.5 * SCALE,
    right: 8.5 * SCALE,
    bottom: 8.5 * SCALE,
    height: 57 * SCALE,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  physioGlassInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8.5 * SCALE,
    paddingVertical: 8 * SCALE,
    gap: 6,
  },
  physioName: {
    fontFamily: font('Regular'),
    fontSize: 11.3 * SCALE,
    color: INK,
  },
  physioSpecialty: {
    fontFamily: font('Regular'),
    fontSize: 6.3 * SCALE,
    color: INK,
    marginTop: 1,
  },
  physioMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10 * SCALE,
    marginTop: 6 * SCALE,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  badgeIcon: { width: 9 * SCALE, height: 9 * SCALE },
  badgePill: {
    width: 9 * SCALE,
    height: 9 * SCALE,
    borderRadius: 4.5 * SCALE,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -2,
  },
  badgeTiny: { width: 4 * SCALE, height: 4 * SCALE },
  physioDist: {
    fontFamily: font('SemiBold'),
    fontSize: 6.3 * SCALE,
    fontWeight: '600',
    color: INK,
  },
  arrowBtn: {
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bodyHotspots: {
    width: CONTENT_W,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10 * SCALE,
  },
  bodyHotspot: {
    width: (CONTENT_W - 10 * SCALE) / 2,
    height: 120 * SCALE,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bodyHotspotImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  bodyHotspotDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  bodyHotspotLabel: {
    fontFamily: font('Medium'),
    fontSize: 13 * SCALE,
    fontWeight: '500',
    color: '#fff',
    padding: 10 * SCALE,
    zIndex: 1,
  },

  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: H_PAD,
    paddingTop: 10 * SCALE,
    gap: 12 * SCALE,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36 * SCALE,
    height: 4 * SCALE,
    borderRadius: 2,
    backgroundColor: 'rgba(51,51,51,0.2)',
    marginBottom: 4 * SCALE,
  },
  sheetHero: {
    width: '100%',
    height: 140 * SCALE,
    borderRadius: 16,
  },
  sheetTitle: {
    fontFamily: font('Medium'),
    fontSize: 24 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  sheetTip: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 21 * SCALE,
    color: 'rgba(51,51,51,0.65)',
  },
  sheetPrimary: {
    height: 48 * SCALE,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4 * SCALE,
  },
  sheetPrimaryText: {
    fontFamily: font('Medium'),
    fontSize: 15 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  sheetSecondary: {
    height: 44 * SCALE,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8 * SCALE,
  },
  sheetSecondaryText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },

  howSection: {
    width: SW,
    minHeight: 620 * SCALE,
    marginTop: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  howBgImage: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '145%',
    width: '100%',
  },
  howOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  howFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 22 * SCALE,
    zIndex: 2,
  },
  howContent: {
    width: CONTENT_W,
    alignSelf: 'center',
    paddingTop: 90 * SCALE,
    gap: 28 * SCALE,
    zIndex: 1,
  },
  howHeader: { gap: 25 * SCALE },
  howCardGlassTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(51,51,51,0.1)',
  },

  storyStrip: {
    gap: 8 * SCALE,
    paddingRight: 8 * SCALE,
  },
  storyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6 * SCALE,
    paddingHorizontal: 12 * SCALE,
    paddingVertical: 10 * SCALE,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  storyChipActive: {
    backgroundColor: ACCENT,
  },
  storyChipDone: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  storyChipNum: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  storyChipNumActive: {
    color: INK,
  },
  storyChipLabel: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(255,255,255,0.9)',
  },
  storyChipLabelActive: {
    fontFamily: font('Medium'),
    fontWeight: '500',
    color: INK,
  },
  storyCard: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 22 * SCALE,
    gap: 10 * SCALE,
  },
  storyCardEyebrow: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  storyCardTitle: {
    fontFamily: font('Medium'),
    fontSize: 22 * SCALE,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 28 * SCALE,
  },
  storyCardBody: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    lineHeight: 19 * SCALE,
    color: 'rgba(255,255,255,0.85)',
  },
  storyCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8 * SCALE,
    paddingTop: 14 * SCALE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  storyCardCtaText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: '#fff',
  },

  tabBar: {
    position: 'absolute',
    left: (SW - CONTENT_W) / 2,
    width: CONTENT_W,
    height: 70 * SCALE,
    borderRadius: 35 * SCALE,
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabItem: {
    width: 67 * SCALE,
    alignItems: 'center',
    gap: 5 * SCALE,
  },
  tabIcon: { width: 22 * SCALE, height: 22 * SCALE },
  tabLabel: {
    fontSize: 11 * SCALE,
    color: INK,
    opacity: 0.55,
  },
  tabLabelActive: { opacity: 1 },
});
