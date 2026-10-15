import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

const EXERCISES = [
  { id: 'hand_raise', name: 'Hand Raise', description: 'Shoulder mobility and strength' },
];

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
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

export default function ExerciseMenuScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const prescription = route.params?.prescription;

  const list = prescription
    ? [{ id: prescription.exerciseId || 'hand_raise', name: 'Hand Raise', description: 'As prescribed by your physiologist' }]
    : EXERCISES;

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="dark-content" />
      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
        <Image
          source={require('../../assets/images/figma/profile/icon_back.png')}
          style={s.backIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.eyebrow}>Care plan</Text>
        <Text style={s.heading}>
          <Text style={s.headingMed}>{prescription ? 'Your prescribed ' : ''}</Text>
          <Text style={s.headingLight}>{prescription ? 'exercise' : 'Exercises'}</Text>
        </Text>
        <Text style={s.subhead}>
          {prescription
            ? 'Guided by your physiologist — camera checks your form.'
            : 'Starter mobility you can do between sessions.'}
        </Text>

        {list.map(ex => (
          <TouchableOpacity
            key={ex.id}
            style={s.card}
            onPress={() => navigation.navigate('Exercise', { exercise: ex, prescription })}
            activeOpacity={0.88}
          >
            <Text style={s.exName}>{ex.name}</Text>
            <Text style={s.exDesc}>{ex.description}</Text>
            {prescription ? (
              <Text style={s.prescDetail}>
                {prescription.targetReps} reps · Raise {prescription.raiseAngleThreshold}° · Lower{' '}
                {prescription.lowerAngleThreshold}°
              </Text>
            ) : null}
            <View style={s.cardCta}>
              <Text style={s.start}>Start with camera</Text>
              <Text style={s.startArrow}>→</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  backBtn: {
    marginLeft: H_PAD,
    width: 40 * SCALE,
    height: 40 * SCALE,
    borderRadius: 20 * SCALE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8 * SCALE,
  },
  backIcon: { width: 18 * SCALE, height: 18 * SCALE },
  content: { paddingHorizontal: H_PAD, paddingTop: 8 * SCALE },
  eyebrow: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6 * SCALE,
  },
  heading: {
    fontSize: 28 * SCALE,
    lineHeight: 34 * SCALE,
    color: INK,
    marginBottom: 6 * SCALE,
  },
  headingMed: { fontFamily: font('Medium'), fontWeight: '500' },
  headingLight: { fontFamily: font('Light'), fontWeight: '300' },
  subhead: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 20 * SCALE,
    color: 'rgba(51,51,51,0.55)',
    marginBottom: 28 * SCALE,
  },
  card: {
    backgroundColor: '#f7f8fb',
    borderRadius: 18,
    padding: 20 * SCALE,
    marginBottom: 14 * SCALE,
    gap: 6 * SCALE,
  },
  exName: {
    fontFamily: font('Medium'),
    fontSize: 18 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  exDesc: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
  prescDetail: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.45)',
    marginTop: 2 * SCALE,
  },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12 * SCALE,
    paddingTop: 14 * SCALE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(51,51,51,0.1)',
  },
  start: {
    fontFamily: font('Medium'),
    fontSize: 14 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  startArrow: {
    fontFamily: font('Light'),
    fontSize: 16 * SCALE,
    color: 'rgba(51,51,51,0.4)',
  },
});
