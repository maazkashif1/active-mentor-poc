import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ImageBackground,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import OnboardingHeader from '../../components/OnboardingHeader';

type Props = NativeStackScreenProps<any, any>;

const AREAS = ['Knee', 'Shoulder', 'Elbow', 'Joints'];
const SIDES = ['Left', 'Right', 'Both'];
const BILATERAL_AREAS = new Set(['Knee', 'Shoulder', 'Elbow']);

const AREA_IMAGES: Record<string, ReturnType<typeof require>> = {
  Knee:     require('../../assets/care_knee.jpg'),
  Shoulder: require('../../assets/care_shoulder.jpg'),
  Elbow:    require('../../assets/care_elbow.jpg'),
  Joints:   require('../../assets/care_shoulder.jpg'),
};

const AREA_LABELS: Record<string, { title: string; sub: string }> = {
  Knee: { title: 'Knee care', sub: 'Guided recovery and strength' },
  Shoulder: { title: 'Shoulder care', sub: 'Mobility and rehabilitation' },
  Elbow: { title: 'Elbow care', sub: 'Rehabilitation and recovery' },
  Joints: { title: 'Joint mobility', sub: 'Guided joint exercises' },
};

const SIDE_QUESTION: Record<string, string> = {
  Knee: 'Which knee?',
  Shoulder: 'Which shoulder?',
  Elbow: 'Which elbow?',
  Joints: 'Which side?',
};

export default function CareAreaScreen({ navigation, route }: Props) {
  const [area, setArea] = useState('Knee');
  const [side, setSide] = useState('');
  const returnTo = (route.params as any)?.returnTo;

  const needsSide = BILATERAL_AREAS.has(area);
  const canContinue = !needsSide || side !== '';

  const handleContinue = () => {
    navigation.navigate('KneeIntake', { area, side: needsSide ? side : '', returnTo });
  };

  const label = AREA_LABELS[area];
  const image = AREA_IMAGES[area];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <OnboardingHeader
          label="Now, your care"
          title="What would you like help with?"
          subtitle="Choose the area that needs attention. We'll keep this quick and simple."
          onBack={() => navigation.goBack()}
          progress={{ current: 2, total: 5 }}
        />
        <View style={s.areaGrid}>
          {AREAS.map(a => (
            <TouchableOpacity
              key={a}
              style={[s.areaBtn, area === a && s.areaBtnActive]}
              onPress={() => { setArea(a); setSide(''); }}
            >
              <Text style={[s.areaBtnText, area === a && s.areaBtnTextActive]}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.imageCard}>
          <ImageBackground source={image} style={s.image} resizeMode="cover" imageStyle={s.imageBorderRadius}>
            <View style={s.imageOverlay} />
            <View style={s.imageLabel}>
              <Text style={s.imageLabelTitle}>{label.title}</Text>
              <Text style={s.imageLabelSub}>{label.sub}</Text>
            </View>
            {needsSide && (
              <View style={s.sideSection}>
                <Text style={s.sideQuestion}>{SIDE_QUESTION[area]}</Text>
                <View style={s.sideRow}>
                  {SIDES.map(sv => (
                    <TouchableOpacity
                      key={sv}
                      style={[s.sideBtn, side === sv && s.sideBtnActive]}
                      onPress={() => setSide(sv)}
                    >
                      <Text style={[s.sideBtnText, side === sv && s.sideBtnTextActive]}>{sv}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ImageBackground>
        </View>
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, !canContinue && s.btnDisabled]}
            onPress={handleContinue}
            disabled={!canContinue}
          >
            <Text style={s.btnText}>Continue</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.footer}>More care areas are coming soon</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 40 },
  areaGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, paddingHorizontal: 23, marginTop: 35,
  },
  areaBtn: {
    borderWidth: 1, borderColor: '#333', borderRadius: 11,
    paddingHorizontal: 20, paddingVertical: 14, minWidth: 80,
    alignItems: 'center',
  },
  areaBtnActive: { backgroundColor: '#333' },
  areaBtnText: { fontSize: 15, color: '#333' },
  areaBtnTextActive: { color: '#fff' },
  imageCard: { marginHorizontal: 23, marginTop: 30 },
  image: { height: 389, justifyContent: 'flex-end' },
  imageBorderRadius: { borderRadius: 20 },
  imageOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20 },
  imageLabel: { alignItems: 'center', marginBottom: 60 },
  imageLabelTitle: { fontSize: 16, color: '#fff', fontWeight: '400' },
  imageLabelSub: { fontSize: 12, color: '#fff', textAlign: 'center' },
  sideSection: { paddingHorizontal: 21, paddingBottom: 20 },
  sideQuestion: { fontSize: 12, color: '#fff', fontWeight: '500', marginBottom: 10 },
  sideRow: { flexDirection: 'row', gap: 8 },
  sideBtn: {
    flex: 1, height: 46, borderRadius: 10,
    backgroundColor: 'rgba(51,51,51,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  sideBtnActive: { backgroundColor: '#fff' },
  sideBtnText: { fontSize: 14, color: '#fff' },
  sideBtnTextActive: { color: '#333' },
  btnRow: { paddingHorizontal: 23, marginTop: 30 },
  btn: {
    backgroundColor: '#333', borderRadius: 17, height: 47,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#333', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 6,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  footer: { fontSize: 12, color: '#333', textAlign: 'center', marginTop: 20 },
});
