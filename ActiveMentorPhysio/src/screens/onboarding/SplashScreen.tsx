import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ImageBackground,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = { navigation: NativeStackNavigationProp<any> };

const BG = require('../../assets/splash_bg.jpg');

export default function SplashScreen({ navigation }: Props) {
  return (
    <ImageBackground source={BG} style={s.bg} resizeMode="cover">
      <View style={s.overlay} />
      <View style={s.center}>
        <Text style={s.title}>PERSONALISED{'\n'}PHYSIOTHERAPY.</Text>
      </View>
      <View style={s.bottom}>
        <Text style={s.subtitle}>
          Follow your treatment plan, complete guided exercises, and stay connected with your physiotherapist.
        </Text>
        <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('Language')}>
          <Text style={s.btnText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.signInBtn} onPress={() => navigation.navigate('Auth')}>
          <Text style={s.signInText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 23 },
  title: {
    color: '#fff', fontSize: 22, fontWeight: '300',
    textAlign: 'center', letterSpacing: 0.66,
    textTransform: 'uppercase', lineHeight: 30,
  },
  bottom: { paddingHorizontal: 23, paddingBottom: 80 },
  subtitle: {
    color: '#fff', fontSize: 12, textAlign: 'center',
    lineHeight: 20, marginBottom: 20,
  },
  btn: {
    backgroundColor: '#fff', borderRadius: 17, height: 47,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#fff', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 15, elevation: 8,
    marginBottom: 12,
  },
  btnText: { color: '#333', fontSize: 14, fontWeight: '500' },
  signInBtn: { alignItems: 'center', justifyContent: 'center', height: 44 },
  signInText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '400' },
});
