import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

export default function MeetingScreen({ navigation, route }: Props) {
  const { meetingUrl, physioName, slotDate, slotTime } =
    route.params as { meetingUrl: string; physioName?: string; slotDate?: string; slotTime?: string };

  async function openMeet() {
    const canOpen = await Linking.canOpenURL(meetingUrl).catch(() => false);
    if (!canOpen) {
      Alert.alert('Cannot open link', 'Could not open Google Meet. Check your internet connection.');
      return;
    }
    await Linking.openURL(meetingUrl);
  }

  return (
    <View style={s.container}>
      <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={s.card}>
        <Text style={s.label}>YOUR CONSULTATION</Text>
        {physioName && <Text style={s.physio}>{physioName}</Text>}
        {slotDate && slotTime && (
          <Text style={s.time}>{slotDate} · {slotTime}</Text>
        )}
        <View style={s.divider} />
        <Text style={s.hint}>
          Tapping the button below will open Google Meet.{'\n'}
          Return to this app when your session ends.
        </Text>
      </View>

      <TouchableOpacity style={s.joinBtn} onPress={openMeet}>
        <Text style={s.joinText}>Open Google Meet</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.doneBtn}
        onPress={() => navigation.replace('ConsultHistory')}>
        <Text style={s.doneText}>I've finished my session</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 24, paddingTop: 60 },
  back: { marginBottom: 32 },
  backText: { color: '#EC9F05', fontSize: 16 },
  card: {
    backgroundColor: '#111', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#222', marginBottom: 24,
  },
  label: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 12 },
  physio: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  time: { color: '#888', fontSize: 15 },
  divider: { height: 1, backgroundColor: '#1e1e1e', marginVertical: 20 },
  hint: { color: '#555', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  joinBtn: {
    backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginBottom: 12,
  },
  joinText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  doneBtn: {
    borderWidth: 1, borderColor: '#333', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  doneText: { color: '#666', fontSize: 15 },
});
