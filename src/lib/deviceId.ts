import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'savvysignal_device_id';

export async function getDeviceId(): Promise<string> {
  // Try hardware-based ID first
  let hardwareId: string | null = null;

  if (Platform.OS === 'android') {
    hardwareId = Application.getAndroidId();
  } else if (Platform.OS === 'ios') {
    hardwareId = await Application.getIosIdForVendorAsync();
  }

  if (hardwareId) {
    return hardwareId;
  }

  // Fallback: generate and persist a UUID
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const uuid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, uuid);
  return uuid;
}
