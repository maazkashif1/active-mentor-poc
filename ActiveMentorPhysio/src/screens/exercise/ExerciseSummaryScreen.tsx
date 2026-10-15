import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

export default function ExerciseSummaryScreen({ navigation, route }: Props) {
  const { exercise, reps, assistedReps = 0, prescription, originalTargetAngle, adaptedTargetAngle, repPeakAngles = [] } = route.params as any;
  const target = prescription?.targetReps ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((reps / target) * 100)) : null;
  const independent = reps - assistedReps;
  const peakMin = repPeakAngles.length ? Math.min(...repPeakAngles) : null;
  const peakMax = repPeakAngles.length ? Math.max(...repPeakAngles) : null;

  return (
    <View style={s.container}>
      <Text style={s.title}>Exercise Complete</Text>
      <Text style={s.exName}>{exercise.name}</Text>

      <Text style={s.repsBig}>{reps}</Text>
      <Text style={s.repsLabel}>reps completed</Text>

      <Text style={s.breakdown}>{independent} independent · {assistedReps} assisted</Text>

      {pct !== null && (
        <Text style={s.score}>{pct}% of target</Text>
      )}

      {adaptedTargetAngle != null && originalTargetAngle != null && (
        <Text style={s.adapted}>
          Adapted target: {Math.round(adaptedTargetAngle)}° (original: {Math.round(originalTargetAngle)}°)
        </Text>
      )}

      {peakMin != null && peakMax != null && (
        <Text style={s.peaks}>
          Range achieved: {peakMin}° – {peakMax}° per rep
        </Text>
      )}

      {prescription && reps > 0 && (
        <Text style={s.saved}>Results saved to your physiologist</Text>
      )}

      <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('NewHome')}>
        <Text style={s.btnText}>Back to Home</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.btnOutline}
        onPress={() => navigation.navigate('ExerciseMenu', { prescription })}>
        <Text style={s.btnOutlineText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { color: '#888', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  exName: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 40 },
  repsBig: { color: '#EC9F05', fontSize: 80, fontWeight: 'bold' },
  repsLabel: { color: '#fff', fontSize: 18, marginBottom: 8 },
  breakdown: { color: '#bbb', fontSize: 15, marginBottom: 8 },
  score: { color: '#4CAF50', fontSize: 16, marginBottom: 8 },
  saved: { color: '#888', fontSize: 13, marginBottom: 20, fontStyle: 'italic' },
  adapted: { color: '#EC9F05', fontSize: 14, marginBottom: 4, textAlign: 'center' },
  peaks: { color: '#aaa', fontSize: 13, marginBottom: 20, textAlign: 'center' },
  btn: {
    backgroundColor: '#EC9F05', borderRadius: 25, paddingVertical: 14,
    paddingHorizontal: 40, marginBottom: 12, minWidth: 200, alignItems: 'center',
  },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  btnOutline: {
    borderWidth: 1, borderColor: '#EC9F05', borderRadius: 25, paddingVertical: 14,
    paddingHorizontal: 40, minWidth: 200, alignItems: 'center',
  },
  btnOutlineText: { color: '#EC9F05', fontWeight: 'bold', fontSize: 16 },
});
