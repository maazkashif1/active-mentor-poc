import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../navigation';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function ProfileScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    AsyncStorage.getItem('userProfile').then(v => {
      if (v) setProfile(JSON.parse(v));
    });
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {(profile?.firstName || '?')[0].toUpperCase()}
          </Text>
        </View>

        <Text style={s.name}>{profile?.firstName || 'Patient'}</Text>
        {profile?.email ? <Text style={s.email}>{profile.email}</Text> : null}
        {profile?.city  ? <Text style={s.sub}>{profile.city}</Text>  : null}

        <View style={s.section}>
          {profile?.dob  && <Row label="Date of Birth" value={profile.dob} />}
          {profile?.city && <Row label="City"          value={profile.city} />}
        </View>

        <TouchableOpacity style={s.historyBtn} onPress={() => navigation.navigate('ConsultHistory')}>
          <Text style={s.historyBtnText}>View Consultation History</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.logoutBtn} onPress={signOut}>
          <Text style={s.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#000' },
  content:     { padding: 24, paddingTop: 20, alignItems: 'center' },
  back:        { alignSelf: 'flex-start', marginBottom: 24 },
  backText:    { color: '#EC9F05', fontSize: 16 },
  avatar:      { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EC9F05', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText:  { color: '#000', fontSize: 32, fontWeight: 'bold' },
  name:        { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  email:       { color: '#888', fontSize: 14, marginBottom: 2 },
  sub:         { color: '#666', fontSize: 13, marginBottom: 24 },
  section:     { width: '100%', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 24 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#222' },
  rowLabel:    { color: '#888', fontSize: 14 },
  rowValue:    { color: '#fff', fontSize: 14 },
  historyBtn:  { width: '100%', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  historyBtnText: { color: '#EC9F05', fontSize: 15, fontWeight: '600' },
  logoutBtn:   { width: '100%', borderWidth: 1, borderColor: '#333', borderRadius: 12, padding: 16, alignItems: 'center' },
  logoutText:  { color: '#888', fontSize: 15 },
});
