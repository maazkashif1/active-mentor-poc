import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../config/api';

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password });
  await AsyncStorage.setItem('token', data.token);
  await AsyncStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export async function register(name: string, email: string, password: string) {
  const { data } = await api.post('/auth/register', { name, email, password, role: 'patient' });
  await AsyncStorage.setItem('token', data.token);
  await AsyncStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export async function logout() {
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('user');
}

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}
