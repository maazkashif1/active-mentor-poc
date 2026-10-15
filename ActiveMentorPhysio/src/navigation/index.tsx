import React, { createContext, useCallback, useContext, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../stores/authStore';

// Onboarding
import SplashScreen from '../screens/onboarding/SplashScreen';
import LanguageScreen from '../screens/onboarding/LanguageScreen';
import PhoneScreen from '../screens/onboarding/PhoneScreen';
import OTPScreen from '../screens/onboarding/OTPScreen';
import UserDetailsScreen from '../screens/onboarding/UserDetailsScreen';
import CareAreaScreen from '../screens/onboarding/CareAreaScreen';
import KneeIntakeScreen from '../screens/onboarding/KneeIntakeScreen';
import SafetyCheckScreen from '../screens/onboarding/SafetyCheckScreen';
import NewHomeScreen from '../screens/onboarding/NewHomeScreen';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';

// Main app
import BookingScreen from '../screens/consultation/BookingScreen';
import ConsultHistoryScreen from '../screens/consultation/ConsultHistoryScreen';
import SessionDetailScreen from '../screens/consultation/SessionDetailScreen';
import MeetingScreen from '../screens/consultation/MeetingScreen';
import PrescriptionsScreen from '../screens/prescription/PrescriptionsScreen';
import ExerciseMenuScreen from '../screens/exercise/ExerciseMenuScreen';
import ExerciseScreen from '../screens/exercise/ExerciseScreen';
import ExerciseSummaryScreen from '../screens/exercise/ExerciseSummaryScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// ── Auth context ──────────────────────────────────────────────────────────────
type AuthCtx = { signIn: (user?: any) => void; signOut: () => void };
export const AuthContext = createContext<AuthCtx>({ signIn: () => {}, signOut: () => {} });
export const useAuth = () => useContext(AuthContext);

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const init = useAuthStore(s => s.init);

  useEffect(() => { init(); }, []);

  const signIn = useCallback((user?: any) => useAuthStore.getState().signIn(user), []);
  const signOut = useCallback(() => useAuthStore.getState().signOut(), []);

  if (isLoggedIn === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#333" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ signIn, signOut }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isLoggedIn ? (
            // ── App stack ──────────────────────────────────────────────────────
            // gestureEnabled:false on NewHome so swipe-back has nowhere to go.
            <>
              <Stack.Screen name="NewHome" component={NewHomeScreen}
                options={{ gestureEnabled: false, animation: 'fade' }} />
              <Stack.Screen name="Booking" component={BookingScreen} />
              <Stack.Screen name="ConsultHistory" component={ConsultHistoryScreen} />
              <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
              <Stack.Screen name="Meeting" component={MeetingScreen}
                options={{ gestureEnabled: false }} />
              <Stack.Screen name="Prescriptions" component={PrescriptionsScreen} />
              <Stack.Screen name="ExerciseMenu" component={ExerciseMenuScreen} />
              <Stack.Screen name="Exercise" component={ExerciseScreen}
                options={{ gestureEnabled: false }} />
              <Stack.Screen name="ExerciseSummary" component={ExerciseSummaryScreen}
                options={{ gestureEnabled: false }} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="CareArea" component={CareAreaScreen} />
              <Stack.Screen name="KneeIntake" component={KneeIntakeScreen} />
              <Stack.Screen name="SafetyCheck" component={SafetyCheckScreen} />
            </>
          ) : (
            // ── Auth stack ─────────────────────────────────────────────────────
            // gestureEnabled:false on Splash so there's no back from it either.
            <>
              <Stack.Screen name="Splash" component={SplashScreen}
                options={{ gestureEnabled: false }} />
              <Stack.Screen name="Language" component={LanguageScreen} />
              <Stack.Screen name="Phone" component={PhoneScreen} />
              <Stack.Screen name="OTP" component={OTPScreen} />
              <Stack.Screen name="UserDetails" component={UserDetailsScreen} />
              <Stack.Screen name="Auth" component={LoginScreen} />
              <Stack.Screen name="SignUp" component={SignUpScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
