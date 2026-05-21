import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';
import { getSubscription, activatePremium } from '../lib/subscription';
import { PaywallModal } from '../components/PaywallModal';
import { colors, radius, font } from '../theme';

export function ProfileScreen() {
  const [postCount, setPostCount] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const deviceId = await getDeviceId();
    const sub = await getSubscription();
    setIsPremium(sub.isPremium);
    setExpiresAt(sub.expiresAt);

    const { count } = await supabase
      .from('speed_posts')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', deviceId);
    setPostCount(count ?? 0);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const isDiscountUnlocked = postCount >= 10;
  const progress = Math.min(postCount / 10, 1);
  const price = isDiscountUnlocked ? '$1' : '$3';

  const handleSubscribe = async (priceUsd: number) => {
    // TODO: wire RevenueCat
    await activatePremium(1);
    setIsPremium(true);
    setShowPaywall(false);
    load();
  };

  const expiryLabel = expiresAt
    ? `Renews ${new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
        }
      >
        <Text style={styles.title}>My Profile</Text>

        {/* Subscription card */}
        <View style={[styles.card, isPremium && styles.premiumCard]}>
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.cardTitle}>
                {isPremium ? 'Premium Member' : 'Free Plan'}
              </Text>
              {isPremium && expiryLabel && (
                <Text style={styles.cardSub}>{expiryLabel}</Text>
              )}
              {!isPremium && (
                <Text style={styles.cardSub}>See only your own check-ins</Text>
              )}
            </View>
            <View style={[styles.statusDot, isPremium ? styles.dotActive : styles.dotInactive]} />
          </View>

          {!isPremium && (
            <TouchableOpacity style={styles.upgradeBtn} onPress={() => setShowPaywall(true)}>
              <Text style={styles.upgradeBtnText}>Upgrade to Premium — {price}/mo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Loyalty progress */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>LOYALTY REWARD</Text>
          <Text style={styles.loyaltyTitle}>
            {isDiscountUnlocked ? '🎉 Discount Unlocked!' : 'Post 10 hotels → pay $1/mo'}
          </Text>
          <Text style={styles.loyaltyCount}>{postCount} / 10 check-ins</Text>

          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          {!isDiscountUnlocked && (
            <Text style={styles.loyaltySub}>
              {10 - postCount} more check-in{10 - postCount !== 1 ? 's' : ''} to unlock the $1/mo rate
            </Text>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Ionicons name="wifi" size={22} color={colors.primary} />
            <Text style={styles.statValue}>{postCount}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
          </View>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Ionicons name="star" size={22} color={isDiscountUnlocked ? colors.green : colors.textMuted} />
            <Text style={[styles.statValue, isDiscountUnlocked && { color: colors.green }]}>
              {isDiscountUnlocked ? '$1' : '$3'}
            </Text>
            <Text style={styles.statLabel}>Your Rate/mo</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
            <Text style={styles.infoText}>GPS verified on every check-in</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="phone-portrait" size={16} color={colors.primary} />
            <Text style={styles.infoText}>Tied to this device — one sub per phone</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time" size={16} color={colors.primary} />
            <Text style={styles.infoText}>1 check-in per hotel per 24 hours</Text>
          </View>
        </View>
      </ScrollView>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSubscribe={handleSubscribe}
        isDiscountUnlocked={isDiscountUnlocked}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: {
    fontSize: font.xxl,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  premiumCard: {
    borderColor: colors.green + '40',
    backgroundColor: colors.greenBg,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: font.lg,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardSub: {
    fontSize: font.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: { backgroundColor: colors.green },
  dotInactive: { backgroundColor: colors.textMuted },
  upgradeBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  upgradeBtnText: {
    fontSize: font.sm,
    fontWeight: '800',
    color: '#fff',
  },
  sectionLabel: {
    fontSize: font.xs,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  loyaltyTitle: {
    fontSize: font.lg,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  loyaltyCount: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  progressBg: {
    height: 8,
    backgroundColor: colors.track,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  loyaltySub: {
    fontSize: font.sm,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: font.xxl,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
