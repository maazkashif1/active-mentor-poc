import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import WebView from 'react-native-webview';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

export default function MeetingScreen({ navigation, route }: Props) {
  const { meetingUrl } = route.params as { meetingUrl: string };
  const [ended, setEnded] = useState(false);

  if (ended) {
    return (
      <View style={s.endedContainer}>
        <Text style={s.endedTitle}>Meeting Ended</Text>
        <Text style={s.endedBody}>
          Your consultation is being transcribed automatically. Your physiologist will review and approve a summary shortly.
        </Text>
        <TouchableOpacity style={s.btn} onPress={() => navigation.replace('ConsultHistory')}>
          <Text style={s.btnText}>View My Consultations</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <WebView
        source={{ uri: meetingUrl }}
        style={s.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
      />
      <View style={s.controls}>
        <TouchableOpacity
          style={s.endBtn}
          onPress={() =>
            Alert.alert('End Meeting', 'Are you sure you want to leave?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Leave', style: 'destructive', onPress: () => setEnded(true) },
            ])
          }>
          <Text style={s.endBtnText}>Leave Meeting</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1 },
  controls: { padding: 16, backgroundColor: '#000' },
  endBtn: {
    backgroundColor: '#CC2222', borderRadius: 25, padding: 14, alignItems: 'center',
  },
  endBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  endedContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 32, alignItems: 'center' },
  endedTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 16 },
  endedBody: { color: '#888', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  btn: { backgroundColor: '#EC9F05', borderRadius: 25, paddingVertical: 14, paddingHorizontal: 28 },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
