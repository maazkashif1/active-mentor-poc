import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import getDevServer from 'react-native/Libraries/Core/Devtools/getDevServer';

// In dev, reach the backend on the same host Metro is served from (the dev
// machine's LAN IP), so a physical device can connect without a hardcoded IP.
// getDevServer() works under the bridgeless new architecture, unlike
// NativeModules.SourceCode.scriptURL. Falls back to localhost.
function devHost(): string {
  try {
    const m = getDevServer().url?.match(/^https?:\/\/([^:/]+)/);
    if (m) return m[1];
  } catch {}
  return 'localhost';
}

const BASE_URL = __DEV__
  ? `http://${devHost()}:3000/api`
  : 'https://your-production-url.com/api';

if (__DEV__) console.log('[api] BASE_URL =', BASE_URL);

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
