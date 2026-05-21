import AsyncStorage from '@react-native-async-storage/async-storage';

const SUB_KEY = 'savvysignal_subscription';

export interface SubscriptionState {
  isPremium: boolean;
  expiresAt: number | null; // timestamp ms
}

export async function getSubscription(): Promise<SubscriptionState> {
  try {
    const raw = await AsyncStorage.getItem(SUB_KEY);
    if (!raw) return { isPremium: false, expiresAt: null };
    const parsed = JSON.parse(raw) as SubscriptionState;
    // Expire check
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      return { isPremium: false, expiresAt: null };
    }
    return parsed;
  } catch {
    return { isPremium: false, expiresAt: null };
  }
}

export async function setSubscription(state: SubscriptionState): Promise<void> {
  await AsyncStorage.setItem(SUB_KEY, JSON.stringify(state));
}

// Called by RevenueCat webhook/purchase flow — wire up later
export async function activatePremium(months = 1): Promise<void> {
  const expiresAt = Date.now() + months * 30 * 24 * 60 * 60 * 1000;
  await setSubscription({ isPremium: true, expiresAt });
}
