// Must be first: polyfills crypto.getRandomValues (used by our AES encryption).
import 'react-native-get-random-values';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import { initHealthKit } from '../constants/healthkit';

export default function RootLayout() {
  useEffect(() => {
    initHealthKit().catch((err) => {
      Alert.alert('HealthKit Error', String(err?.message ?? err), [{ text: 'OK' }]);
    });
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
