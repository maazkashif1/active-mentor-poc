import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

const EXERCISES = [
  { id: 'hand_raise', name: 'Hand Raise', description: 'Shoulder mobility and strength' },
];

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

export default function ExerciseMenuScreen({ navigation, route }: Props) {
  const prescription = route.params?.prescription;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.heading}>{prescription ? 'Your Prescribed Exercise' : 'Exercises'}</Text>

      {(prescription
        ? [{ id: prescription.exerciseId || 'hand_raise', name: 'Hand Raise', description: 'As prescribed by your physiologist' }]
        : EXERCISES
      ).map(ex => (
        <TouchableOpacity
          key={ex.id}
          style={s.card}
          onPress={() => navigation.navigate('Exercise', { exercise: ex, prescription })}>
          <Text style={s.exName}>{ex.name}</Text>
          <Text style={s.exDesc}>{ex.description}</Text>
          {prescription && (
            <Text style={s.prescDetail}>
              {prescription.targetReps} reps · Raise {prescription.raiseAngleThreshold}° · Lower {prescription.lowerAngleThreshold}°
            </Text>
          )}
          <Text style={s.start}>Start with camera →</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 20, paddingTop: 60 },
  heading: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 20, marginBottom: 14 },
  exName: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  exDesc: { color: '#888', fontSize: 13, marginBottom: 8 },
  prescDetail: { color: '#EC9F05', fontSize: 13, marginBottom: 4 },
  start: { color: '#4CAF50', fontSize: 14, fontWeight: '600', marginTop: 4 },
});
