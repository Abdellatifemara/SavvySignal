import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';
import { SpeedCard } from '../components/SpeedCard';
import { PaywallModal } from '../components/PaywallModal';
import { getSubscription, activatePremium } from '../lib/subscription';
import { SpeedPost, PlaceType } from '../types';
import { colors, radius, font } from '../theme';

const PLACE_FILTERS: Array<PlaceType | 'All'> = ['All', 'Hotel', 'Motel', 'Hostel', 'Airbnb', 'Resort'];

export function ExploreScreen() {
  const [posts, setPosts] = useState<SpeedPost[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [placeFilter, setPlaceFilter] = useState<PlaceType | 'All'>('All');
  const [showPaywall, setShowPaywall] = useState(false);
  const [myPostCount, setMyPostCount] = useState(0);

  useEffect(() => {
    (async () => {
      const id = await getDeviceId();
      setDeviceId(id);
      const sub = await getSubscription();
      setIsPremium(sub.isPremium);
      await loadPosts(id, sub.isPremium);
    })();
  }, []);

  const loadPosts = useCallback(async (devId: string, premium: boolean) => {
    setLoading(true);
    try {
      let query = supabase
        .from('speed_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!premium) {
        // Free: own posts only
        query = query.eq('device_id', devId);
      } else {
        // Premium: all posts, limit 200
        query = query.limit(200);
      }

      if (placeFilter !== 'All') {
        query = query.eq('place_type', placeFilter);
      }

      if (search.trim()) {
        query = query.ilike('hotel_name', `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPosts(data ?? []);

      // Count own posts for loyalty
      if (devId) {
        const { count } = await supabase
          .from('speed_posts')
          .select('*', { count: 'exact', head: true })
          .eq('device_id', devId);
        setMyPostCount(count ?? 0);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [placeFilter, search]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts(deviceId, isPremium);
  }, [deviceId, isPremium, loadPosts]);

  const handleSubscribe = async (price: number) => {
    // TODO: wire RevenueCat purchase here
    // For now simulate activation
    await activatePremium(1);
    setIsPremium(true);
    setShowPaywall(false);
    loadPosts(deviceId, true);
  };

  const isDiscountUnlocked = myPostCount >= 10;

  const filtered = posts.filter(p => {
    const matchSearch = search
      ? p.hotel_name.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchType = placeFilter === 'All' ? true : p.place_type === placeFilter;
    return matchSearch && matchType;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>SavvySignal</Text>
            <Text style={styles.tagline}>Hotel WiFi, Crowd-Verified</Text>
          </View>
          <TouchableOpacity
            style={[styles.premiumBadge, isPremium && styles.premiumBadgeActive]}
            onPress={() => !isPremium && setShowPaywall(true)}
          >
            <Ionicons
              name={isPremium ? 'star' : 'star-outline'}
              size={13}
              color={isPremium ? colors.green : colors.textMuted}
            />
            <Text style={[styles.premiumText, isPremium && styles.premiumTextActive]}>
              {isPremium ? 'Premium' : 'Free'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search hotels..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => loadPosts(deviceId, isPremium)}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Place filter */}
        <FlatList
          data={PLACE_FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={i => i}
          style={styles.filterRow}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          renderItem={({ item }) => {
            const active = placeFilter === item;
            return (
              <TouchableOpacity
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setPlaceFilter(item as PlaceType | 'All')}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />

        {/* Free banner */}
        {!isPremium && (
          <TouchableOpacity style={styles.freeBanner} onPress={() => setShowPaywall(true)}>
            <Ionicons name="lock-closed" size={13} color={colors.primary} />
            <Text style={styles.freeBannerText}>
              You're seeing your check-ins only.{' '}
              <Text style={styles.freeBannerCta}>Go Premium →</Text>
            </Text>
          </TouchableOpacity>
        )}

        {/* List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="wifi-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptyText}>
              {isPremium ? 'Try adjusting your filters.' : 'Post your first check-in to get started.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={p => p.id}
            renderItem={({ item }) => (
              <SpeedCard post={item} isOwn={item.device_id === deviceId} />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
          />
        )}
      </View>

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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  appName: {
    fontSize: font.xxl,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '600',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  premiumBadgeActive: {
    borderColor: colors.green + '50',
    backgroundColor: colors.greenBg,
  },
  premiumText: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '700',
  },
  premiumTextActive: {
    color: colors.green,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    gap: 8,
  },
  searchIcon: { marginRight: 4 },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: font.md,
  },
  filterRow: { marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  freeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    marginHorizontal: 16,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  freeBannerText: {
    fontSize: font.sm,
    color: colors.textSecondary,
  },
  freeBannerCta: {
    color: colors.primary,
    fontWeight: '700',
  },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  emptyTitle: {
    fontSize: font.lg,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: font.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
