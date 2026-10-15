import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ImageBackground, Image,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../navigation';
import { useAppStore } from '../../stores/appStore';

type Props = { navigation: NativeStackNavigationProp<any> };

const IMG = {
  hero: require('../../assets/images/home_hero.png'),
  howBg: require('../../assets/images/home_how_bg.png'),
  ahmed: require('../../assets/images/physio_ahmed.png'),
  sania: require('../../assets/images/physio_sania.png'),
  knee: require('../../assets/images/care_knee.png'),
  elbow: require('../../assets/images/care_elbow.png'),
  mobility: require('../../assets/images/care_mobility.png'),
};

const HOW_STEPS = [
  { num: '01', title: 'Find your physiotherapist', body: 'Explore physiotherapists based on your needs and location.' },
  { num: '02', title: 'Book your assessment', body: 'Choose a clinic, date, and time that works for you.' },
  { num: '03', title: 'Start your care plan', body: 'Your physiotherapist creates a personalized rehabilitation plan.' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning,';
  if (h < 17) return 'Good Afternoon,';
  return 'Good Evening,';
}

function PhysioCard({ physio }: { physio: any }) {
  const photoUri = physio.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(physio.name)}&background=DA7235&color=fff&size=175`;
  return (
    <View style={s.physioCard}>
      <Image source={{ uri: photoUri }} style={s.physioImg} resizeMode="cover" />
      <View style={s.physioInfo}>
        <Text style={s.physioName}>{physio.name}</Text>
        <Text style={s.physioSpecialty}>{physio.specialty || physio.specialization || ''}</Text>
        {physio.yearsExperience != null && (
          <Text style={s.physioDist}>{physio.yearsExperience} yrs experience</Text>
        )}
      </View>
    </View>
  );
}

export default function NewHomeScreen({ navigation }: Props) {
  const [firstName, setFirstName] = useState('');
  const [hasIntake, setHasIntake] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const physios = useAppStore(s => s.physios);
  const fetchPhysios = useAppStore(s => s.fetchPhysios);

  useEffect(() => {
    console.log('[NewHomeScreen] mount');
    AsyncStorage.getItem('userProfile').then(v => {
      if (v) {
        const p = JSON.parse(v);
        setFirstName(p.firstName || '');
        setHasIntake(!!p.careArea);
        console.log('[NewHomeScreen] profile loaded', { firstName: p.firstName, careArea: p.careArea });
      }
    });
    if (!physios.length) {
      console.log('[NewHomeScreen] fetching physios');
      fetchPhysios();
    }
    return () => console.log('[NewHomeScreen] unmount');
  }, []);

  const goToBooking = () => {
    if (hasIntake) {
      navigation.navigate('Booking' as any);
    } else {
      navigation.navigate('CareArea' as any, { returnTo: 'Booking' });
    }
  };

  const { signOut } = useAuth();

  const TAB_ITEMS: { label: string; icon: string; action?: () => void; screen?: string }[] = [
    { label: 'Home', icon: '⌂' },
    { label: 'Search', icon: '⌕', action: goToBooking },
    { label: 'Exercises', icon: '◉', screen: 'Prescriptions' },
    { label: 'History', icon: '◷', screen: 'ConsultHistory' },
    { label: 'Profile', icon: '👤', screen: 'Profile' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <ImageBackground source={IMG.hero} style={s.hero} resizeMode="cover">
          <View style={s.heroOverlay} />
          <View style={s.heroBody}>
            <Text style={s.helloText}>
              <Text style={s.helloLight}>Hello, </Text>
              <Text style={s.helloBold}>{firstName || 'there'}!</Text>
            </Text>
            <View style={s.heroSub}>
              <Text style={s.greet}>{greeting()}</Text>
              <Text style={s.headline}>Let's find the right{'\n'}physiotherapist for you.</Text>
            </View>
          </View>
          <TouchableOpacity style={s.findBtnWrapper} onPress={() => goToBooking()} activeOpacity={0.85}>
            <BlurView style={s.findBtn} blurType="light" blurAmount={18} reducedTransparencyFallbackColor="rgba(255,255,255,0.7)">
              <Text style={s.findBtnText}>Find a Physiotherapist</Text>
            </BlurView>
          </TouchableOpacity>
        </ImageBackground>

        {/* Matched to your needs */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleBlock}>
              <Text style={s.sectionTitle}>
                <Text style={s.titleMed}>Matched </Text>
                <Text style={s.titleLight}>to your needs</Text>
              </Text>
              <Text style={s.sectionSub}>Based on your selected concern and preferences.</Text>
            </View>
            <TouchableOpacity style={s.seeMoreBtn} onPress={() => goToBooking()}>
              <Text style={s.seeMoreText}>See More →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.physioList}>
            {physios.slice(0, 6).map((p, i) => <PhysioCard key={i} physio={p} />)}
          </ScrollView>
        </View>

        {/* What do you need help with? */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleBlock}>
              <Text style={s.sectionTitle}>
                <Text style={s.titleLight}>What do you need </Text>
                <Text style={s.titleMed}>help with?</Text>
              </Text>
              <Text style={s.sectionSub}>Choose an area to see physiotherapists who commonly treat it.</Text>
            </View>
            <TouchableOpacity style={s.seeMoreBtn} onPress={() => goToBooking()}>
              <Text style={s.seeMoreText}>See More →</Text>
            </TouchableOpacity>
          </View>
          {/* Knee — full width */}
          <ImageBackground source={IMG.knee} style={s.careCardWide} resizeMode="cover" imageStyle={s.careCardRadius}>
            <View style={s.careOverlay} />
            <Text style={s.careTitle}>Knee Rehabilitation</Text>
            <Text style={s.careSub}>Focused recovery to restore knee strength, stability, and mobility after ACL injury.</Text>
          </ImageBackground>
          {/* Elbow + Mobility — split */}
          <View style={s.careRow}>
            <ImageBackground source={IMG.elbow} style={s.careCardSmall} resizeMode="cover" imageStyle={s.careCardRadius}>
              <View style={s.careOverlay} />
              <Text style={s.careTitle}>Elbow Care</Text>
              <Text style={s.careSub}>Relieve pain and restore elbow movement.</Text>
            </ImageBackground>
            <ImageBackground source={IMG.mobility} style={s.careCardLarge} resizeMode="cover" imageStyle={s.careCardRadius}>
              <View style={s.careOverlay} />
              <Text style={s.careTitle}>Mobility Care</Text>
              <Text style={s.careSub}>Focused recovery to restore strength and mobility.</Text>
            </ImageBackground>
          </View>
        </View>

        {/* Physiotherapists near you */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleBlock}>
              <Text style={s.sectionTitle}>
                <Text style={s.titleMed}>Physiotherapists </Text>
                <Text style={s.titleLight}>near you</Text>
              </Text>
              <Text style={s.sectionSub}>Discover trusted physiotherapists nearby and find the right care for your needs.</Text>
            </View>
            <TouchableOpacity style={s.seeMoreBtn} onPress={() => goToBooking()}>
              <Text style={s.seeMoreText}>See More →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.physioList}>
            {[...physios].reverse().slice(0, 6).map((p, i) => <PhysioCard key={i} physio={p} />)}
          </ScrollView>
        </View>

        {/* How We Work */}
        <ImageBackground source={IMG.howBg} style={s.howSection} resizeMode="cover">
          <View style={s.howOverlay} />
          <View style={s.howContent}>
            <View style={s.sectionHeader}>
              <View style={s.sectionTitleBlock}>
                <Text style={s.howTitle}>
                  {'How '}
                  <Text style={s.howTitleMed}>We</Text>
                  {' work'}
                </Text>
                <Text style={s.howSub}>From finding your physiotherapist to starting your recovery plan.</Text>
              </View>
              <TouchableOpacity style={s.seeMoreBtn} onPress={() => goToBooking()}>
                <Text style={[s.seeMoreText, { color: '#fff' }]}>See More →</Text>
              </TouchableOpacity>
            </View>
            {HOW_STEPS.map(step => (
              <BlurView key={step.num} style={s.howCard} blurType="dark" blurAmount={8} reducedTransparencyFallbackColor="rgba(51,51,51,0.3)">
                <View style={s.howCardLeft}>
                  <Text style={s.howCardTitle}>{step.title}</Text>
                  <Text style={s.howCardBody}>{step.body}</Text>
                </View>
                <Text style={s.howCardNum}>{step.num}</Text>
              </BlurView>
            ))}
          </View>
        </ImageBackground>

        {/* Log out (in profile area) */}
        <View style={s.logoutSection}>
          <TouchableOpacity style={s.logoutBtn} onPress={signOut}>
            <Text style={s.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Bottom Tab Bar — floats over scroll content */}
      <BlurView style={s.tabBar} blurType="light" blurAmount={20} reducedTransparencyFallbackColor="#e0e7ef">
        {TAB_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={s.tabItem}
            onPress={() => { setActiveTab(item.label); if (item.action) item.action(); else if (item.screen) navigation.navigate(item.screen as any); }}
          >
            <Text style={[s.tabIcon, activeTab === item.label && s.tabIconActive]}>{item.icon}</Text>
            <Text style={[s.tabLabel, activeTab === item.label && s.tabLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </BlurView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { paddingBottom: 0 },

  // Hero
  hero: { minHeight: 520 },
  heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.2)' },
  heroBody: { paddingHorizontal: 24, paddingTop: 20, gap: 16 },
  helloText: { fontSize: 36, lineHeight: 44, color: '#fff' },
  helloLight: { fontWeight: '300' },
  helloBold: { fontWeight: '600' },
  heroSub: { gap: 4 },
  greet: { color: '#fff', fontSize: 14, fontWeight: '300', lineHeight: 20 },
  headline: { color: '#fff', fontSize: 24, fontWeight: '600', lineHeight: 30 },
  findBtnText: { color: '#333', fontSize: 16, fontWeight: '300' },

  // Sections
  section: { paddingHorizontal: 24, paddingTop: 50, gap: 25 },
  sectionHeader: { gap: 25 },
  sectionTitleBlock: { gap: 5 },
  sectionTitle: { fontSize: 30, lineHeight: 38, color: '#333' },
  titleLight: { fontWeight: '300' },
  titleMed: { fontWeight: '500' },
  sectionSub: { fontSize: 14, color: '#333', fontWeight: '300', lineHeight: 20 },
  seeMoreBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end' },
  seeMoreText: { fontSize: 14, color: 'rgba(51,51,51,0.5)', fontWeight: '300' },

  // Physio cards
  physioList: { gap: 12, paddingRight: 24 },
  physioCard: {
    width: 175, borderRadius: 13, overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  physioImg: { width: 175, height: 175 },
  physioInfo: { padding: 10, gap: 2 },
  physioName: { fontSize: 12, color: '#333', fontWeight: '400' },
  physioSpecialty: { fontSize: 8, color: 'rgba(51,51,51,0.6)', lineHeight: 12 },
  physioDist: { fontSize: 8, color: '#333', fontWeight: '600', marginTop: 4 },

  // Care area cards
  careCardWide: { height: 148, justifyContent: 'flex-end', padding: 16 },
  careCardRadius: { borderRadius: 20 },
  careRow: { flexDirection: 'row', gap: 10 },
  careCardSmall: { flex: 1, height: 158, justifyContent: 'flex-end', padding: 12 },
  careCardLarge: { flex: 1.75, height: 158, justifyContent: 'flex-end', padding: 14 },
  careOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 20 },
  careTitle: { color: '#fff', fontSize: 14, fontWeight: '400', lineHeight: 20 },
  careSub: { color: '#fff', fontSize: 10, fontWeight: '300', lineHeight: 13, marginTop: 4 },

  // How we work
  howSection: { minHeight: 600, marginTop: 50 },
  howOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.2)' },
  howContent: { padding: 24, paddingTop: 50, gap: 25 },
  howTitle: { fontSize: 30, color: '#fff', fontWeight: '300', lineHeight: 38 },
  howTitleMed: { fontWeight: '500' },
  howSub: { fontSize: 14, color: '#fff', fontWeight: '300', lineHeight: 20 },
  howCard: {
    borderRadius: 15, overflow: 'hidden', padding: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  howCardLeft: { flex: 1, gap: 10, paddingRight: 16 },
  howCardTitle: { color: '#fff', fontSize: 16, fontWeight: '500', lineHeight: 20 },
  howCardBody: { color: '#fff', fontSize: 14, fontWeight: '300', lineHeight: 18 },
  howCardNum: { color: '#fff', fontSize: 20, fontWeight: '300', opacity: 0.6 },

  // Logout
  logoutSection: { paddingHorizontal: 24, paddingTop: 30 },
  logoutBtn: {
    borderWidth: 1, borderColor: 'rgba(51,51,51,0.15)',
    borderRadius: 12, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { color: 'rgba(51,51,51,0.5)', fontSize: 14 },

  // Find button
  findBtnWrapper: {
    marginHorizontal: 24, marginTop: 16, marginBottom: 20,
    borderRadius: 20, overflow: 'hidden',
  },
  findBtn: {
    height: 45, alignItems: 'center', justifyContent: 'center',
  },

  // Bottom tab bar — absolute, floats over scroll content
  tabBar: {
    position: 'absolute', bottom: 10, left: 20, right: 20,
    height: 70,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    borderRadius: 35, overflow: 'hidden',
    paddingHorizontal: 10,
    shadowColor: '#333', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  tabItem: { alignItems: 'center', gap: 4, flex: 1 },
  tabIcon: { fontSize: 18, color: 'rgba(51,51,51,0.4)' },
  tabIconActive: { color: '#333' },
  tabLabel: { fontSize: 10, color: 'rgba(51,51,51,0.4)' },
  tabLabelActive: { color: '#333', fontWeight: '500' },
});
