import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

const SW = Dimensions.get('window').width;
const SCALE = SW / 390;
const ACCENT = '#e0e7ef';
const INK = '#333333';

const font = (weight: 'Light' | 'Regular' | 'Medium' | 'SemiBold' | 'Bold') =>
  Platform.select({
    ios: `Poppins-${weight}`,
    android: `Poppins-${weight}`,
    default: undefined,
  });

export default function ExerciseSummaryScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const {
    exercise,
    reps,
    assistedReps = 0,
    prescription,
    originalTargetAngle,
    adaptedTargetAngle,
    repPeakAngles = [],
  } = route.params as any;
  const target = prescription?.targetReps ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((reps / target) * 100)) : null;
  const independent = reps - assistedReps;
  const peakMin = repPeakAngles.length ? Math.min(...repPeakAngles) : null;
  const peakMax = repPeakAngles.length ? Math.max(...repPeakAngles) : null;

  return (
    <View style={[s.root, { paddingTop: insets.top + 24 * SCALE, paddingBottom: insets.bottom + 24 * SCALE }]}>
      <StatusBar barStyle="dark-content" />

      <Text style={s.eyebrow}>Session done</Text>
      <Text style={s.title}>Exercise complete</Text>
      <Text style={s.exName}>{exercise?.name || 'Exercise'}</Text>

      <View style={s.heroCard}>
        <Text style={s.repsBig}>{reps}</Text>
        <Text style={s.repsLabel}>reps completed</Text>
        <Text style={s.breakdown}>
          {independent} independent · {assistedReps} assisted
        </Text>
        {pct !== null ? (
          <View style={s.pill}>
            <Text style={s.pillText}>{pct}% of target</Text>
          </View>
        ) : null}
      </View>

      {(adaptedTargetAngle != null && originalTargetAngle != null) || (peakMin != null && peakMax != null) ? (
        <View style={s.metaBlock}>
          {adaptedTargetAngle != null && originalTargetAngle != null ? (
            <Text style={s.meta}>
              Adapted target: {Math.round(adaptedTargetAngle)}° (original: {Math.round(originalTargetAngle)}°)
            </Text>
          ) : null}
          {peakMin != null && peakMax != null ? (
            <Text style={s.meta}>
              Range achieved: {peakMin}° – {peakMax}° per rep
            </Text>
          ) : null}
        </View>
      ) : null}

      {prescription && reps > 0 ? (
        <Text style={s.saved}>Results saved to your physiologist</Text>
      ) : null}

      <View style={s.actions}>
        <TouchableOpacity
          style={s.btn}
          onPress={() => navigation.navigate('NewHome')}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>Back to Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.btnQuiet}
          onPress={() => navigation.navigate('ExerciseMenu', { prescription })}
          activeOpacity={0.85}
        >
          <Text style={s.btnQuietText}>Try again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 28 * SCALE,
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6 * SCALE,
  },
  title: {
    fontFamily: font('Medium'),
    fontSize: 28 * SCALE,
    fontWeight: '500',
    color: INK,
    lineHeight: 34 * SCALE,
  },
  exName: {
    fontFamily: font('Light'),
    fontSize: 15 * SCALE,
    color: 'rgba(51,51,51,0.55)',
    marginTop: 4 * SCALE,
    marginBottom: 28 * SCALE,
  },
  heroCard: {
    backgroundColor: '#f7f8fb',
    borderRadius: 20,
    paddingVertical: 28 * SCALE,
    paddingHorizontal: 20 * SCALE,
    alignItems: 'center',
    gap: 4 * SCALE,
  },
  repsBig: {
    fontFamily: font('Medium'),
    fontSize: 72 * SCALE,
    fontWeight: '500',
    color: INK,
    lineHeight: 80 * SCALE,
  },
  repsLabel: {
    fontFamily: font('Light'),
    fontSize: 15 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },
  breakdown: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.45)',
    marginTop: 8 * SCALE,
  },
  pill: {
    marginTop: 14 * SCALE,
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingHorizontal: 14 * SCALE,
    paddingVertical: 7 * SCALE,
  },
  pillText: {
    fontFamily: font('Medium'),
    fontSize: 12 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  metaBlock: {
    marginTop: 20 * SCALE,
    gap: 6 * SCALE,
  },
  meta: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    lineHeight: 19 * SCALE,
    color: 'rgba(51,51,51,0.55)',
    textAlign: 'center',
  },
  saved: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.4)',
    textAlign: 'center',
    marginTop: 16 * SCALE,
  },
  actions: {
    marginTop: 32 * SCALE,
    gap: 10 * SCALE,
  },
  btn: {
    height: 48 * SCALE,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: font('Medium'),
    fontSize: 15 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  btnQuiet: {
    height: 44 * SCALE,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnQuietText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
});
