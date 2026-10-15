import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Image,
  StatusBar,
  Dimensions,
  Platform,
  LogBox,
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

const HOW_STEPS = [
  {
    num: '01',
    title: 'Find your physiotherapist',
    body: 'Explore physiotherapists based on your needs and location.',
  },
  {
    num: '02',
    title: 'Book your assessment',
    body: 'Choose a clinic, date, and time that works for you.',
  },
  {
    num: '03',
    title: 'Start your care plan',
    body: 'Your physiotherapist creates a personalized rehabilitation plan.',
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
  if (h < 12) return 'Good Morning,';
  if (h < 17) return 'Good Afternoon,';
  return 'Good Evening,';
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

function CareCard({
  source,
  title,
  sub,
  width,
  height,
  onPress,
}: {
  source: any;
  title: string;
  sub: string;
  width: number;
  height: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={{ width, height }}>
      <ImageBackground
        source={source}
        style={{ width, height, borderRadius: 20, overflow: 'hidden', justifyContent: 'space-between' }}
        resizeMode="cover"
        imageStyle={{ borderRadius: 20 }}
      >
        <View style={s.careDim} />
        <View style={s.careTextBlock}>
          <Text style={s.careTitle}>{title}</Text>
          <Text style={s.careSub}>{sub}</Text>
        </View>
        <View style={s.careArrowRow}>
          <ArrowBtn />
        </View>
      </ImageBackground>
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
  const [activeTab, setActiveTab] = useState('Home');
  const [greet, setGreet] = useState(() => greetingForHour(new Date().getHours()));
  const physios = useAppStore(s => s.physios);
  const fetchPhysios = useAppStore(s => s.fetchPhysios);

  useEffect(() => {
    AsyncStorage.getItem('userProfile').then(v => {
      if (v) {
        const p = JSON.parse(v);
        setFirstName(p.firstName || '');
      }
    });
    if (!physios.length) fetchPhysios();
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

          {/* Frame 104:647 — 342×44, 51pt below content frame */}
          <TouchableOpacity
            style={[s.findBtn, { top: heroCtaTop }]}
            onPress={() => goToFind()}
            activeOpacity={0.85}
          >
            <Text style={s.findBtnText}>Find a Physiotherapist</Text>
          </TouchableOpacity>

          <LinearGradient colors={['rgba(255,255,255,0)', '#fff']} style={s.heroFade} pointerEvents="none" />
        </View>

        {/* Matched */}
        <View style={s.section}>
          <SectionHeader
            titleNode={
              <>
                <Text style={s.titleMed}>Matched</Text>
                <Text style={s.titleLight}> to your needs</Text>
              </>
            }
            sub="Based on your selected concern and preferences."
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

        {/* Care areas */}
        <View style={s.section}>
          <SectionHeader
            titleNode={
              <>
                <Text style={s.titleLight}>What do you need </Text>
                <Text style={s.titleMed}>help with?</Text>
              </>
            }
            sub="Choose an area to see physiotherapists who commonly treat it."
            onSeeMore={() => goToFind()}
          />
          <View style={s.careStack}>
            <CareCard
              source={IMG.knee}
              title="Knee Rehabilitation"
              sub="Focused recovery to restore knee strength, stability, and mobility after ACL injury."
              width={CONTENT_W}
              height={148 * SCALE}
              onPress={() => goToFind('Knee Rehab')}
            />
            <View style={s.careRow}>
              <CareCard
                source={IMG.elbow}
                title="Elbow Care"
                sub="Relieve pain and restore shoulder movement."
                width={121 * SCALE}
                height={158 * SCALE}
                onPress={() => goToFind('Elbow Care')}
              />
              <CareCard
                source={IMG.mobility}
                title="Mobility Care"
                sub="Focused recovery to restore knee strength, stability, and mobility after ACL injury."
                width={212 * SCALE}
                height={158 * SCALE}
                onPress={() => goToFind('Mobility Care')}
              />
            </View>
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

        {/* How we work — same soft white fade as hero → content */}
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
                  <Text style={s.titleLight}>How </Text>
                  <Text style={s.titleMed}>We</Text>
                  <Text style={s.titleLight}> work</Text>
                </>
              }
              sub="From finding your physiotherapist to starting your recovery plan."
              onSeeMore={() => goToFind()}
              light
              seeMoreLower
            />
            <View style={s.howSteps}>
              {HOW_STEPS.map(step => (
                <TouchableOpacity
                  key={step.num}
                  style={s.howCard}
                  onPress={() => goToFind()}
                  activeOpacity={0.85}
                >
                  <BlurView
                    style={StyleSheet.absoluteFill}
                    blurType="light"
                    blurAmount={7}
                    reducedTransparencyFallbackColor="rgba(51,51,51,0.15)"
                    pointerEvents="none"
                  />
                  <View style={s.howCardGlassTint} pointerEvents="none" />
                  <View style={s.howCardRow}>
                    <View style={s.howCardLeft}>
                      <Text style={s.howCardTitle}>{step.title}</Text>
                      <Text style={s.howCardBody}>{step.body}</Text>
                    </View>
                    <View style={s.howCardRight}>
                      <Text style={s.howCardNum}>{step.num}</Text>
                      <View style={s.howPlus}>
                        <Image source={IMG.plus} style={{ width: 12, height: 12 }} resizeMode="contain" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

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

  careStack: { gap: 15 * SCALE },
  careRow: { flexDirection: 'row', gap: 10 * SCALE },
  careDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
  },
  careTextBlock: {
    paddingTop: 23 * SCALE,
    paddingHorizontal: 16 * SCALE,
    gap: 12 * SCALE,
    zIndex: 1,
  },
  careTitle: {
    fontFamily: font('Light'),
    fontSize: 16 * SCALE,
    lineHeight: 20 * SCALE,
    fontWeight: '300',
    color: '#fff',
  },
  careSub: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    lineHeight: 13 * SCALE,
    fontWeight: '300',
    color: '#fff',
  },
  careArrowRow: {
    alignItems: 'flex-end',
    paddingRight: 8 * SCALE,
    paddingBottom: 8 * SCALE,
    zIndex: 1,
  },

  // Figma image 30: 390×859; content frame 343×588 at x=24
  howSection: {
    width: SW,
    minHeight: 859 * SCALE,
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
  // Figma white blur strip ≈ 22pt above content
  howFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 22 * SCALE,
    zIndex: 2,
  },
  // paddingTop 90 = image→content offset (2314−2224); gap 50 = header→cards
  howContent: {
    width: CONTENT_W,
    alignSelf: 'center',
    paddingTop: 90 * SCALE,
    gap: 50 * SCALE,
    zIndex: 1,
  },
  // Figma header: gap 25 between title block and See More
  howHeader: { gap: 25 * SCALE },
  howSteps: { gap: 10 * SCALE },
  howCard: {
    borderRadius: 15,
    overflow: 'hidden',
    padding: 20 * SCALE,
    backgroundColor: 'transparent',
  },
  // Figma: backdrop-blur-[7.3px] bg-[rgba(51,51,51,0.1)]
  howCardGlassTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(51,51,51,0.1)',
  },
  howCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  howCardLeft: { width: 240 * SCALE, gap: 20 * SCALE },
  howCardRight: {
    width: 25 * SCALE,
    height: 86 * SCALE,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  howCardTitle: {
    fontFamily: font('Medium'),
    fontSize: 16 * SCALE,
    lineHeight: 20 * SCALE,
    fontWeight: '500',
    color: '#fff',
  },
  howCardBody: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 18 * SCALE,
    fontWeight: '300',
    color: '#fff',
  },
  howCardNum: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    fontWeight: '300',
    color: '#fff',
    textAlign: 'center',
  },
  howPlus: {
    width: 25 * SCALE,
    height: 25 * SCALE,
    borderRadius: 12.5 * SCALE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
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
