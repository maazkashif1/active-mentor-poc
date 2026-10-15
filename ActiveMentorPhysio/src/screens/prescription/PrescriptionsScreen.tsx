import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAppStore } from '../../stores/appStore';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function PrescriptionsScreen({ navigation }: Props) {
  const prescriptions = useAppStore(s => s.prescriptions);
  const loading = useAppStore(s => s.loading.prescriptions);
  const fetchPrescriptions = useAppStore(s => s.fetchPrescriptions);

  useFocusEffect(useCallback(() => { fetchPrescriptions(); }, []));

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#EC9F05" size="large" /></View>;
  }

  return (
    <View style={s.container}>
      <Text style={s.heading}>Prescribed Exercises</Text>
      <FlatList
        data={prescriptions}
        keyExtractor={i => i._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchPrescriptions} tintColor="#EC9F05" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('ExerciseMenu', { prescription: item })}>
            <Text style={s.exerciseName}>{{ hand_raise: 'Hand Raise', squat: 'Squat', push_up: 'Push Up' }[item.exerciseId as string] ?? 'Hand Raise'}</Text>
            <Text style={s.detail}>Target: {item.targetReps} reps</Text>
            <Text style={s.detail}>Raise angle: {item.raiseAngleThreshold}°  Lower: {item.lowerAngleThreshold}°</Text>
            {item.notes && <Text style={s.notes}>{item.notes}</Text>}
            <Text style={s.startText}>Start exercise →</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={s.empty}>No prescriptions yet. Complete a consultation to receive one.</Text>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  heading: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12 },
  exerciseName: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  detail: { color: '#888', fontSize: 13, marginBottom: 2 },
  notes: { color: '#ccc', fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  startText: { color: '#EC9F05', fontSize: 14, marginTop: 12, fontWeight: '600' },
  empty: { color: '#555', textAlign: 'center', marginTop: 60, lineHeight: 22 },
});
