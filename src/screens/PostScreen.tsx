import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';
import { runSpeedTest } from '../lib/speedTest';
import { SpeedMeter } from '../components/SpeedMeter';
import { SpeedTestStatus } from '../types';
import { colors, radius, font } from '../theme';

interface NearbyPlace {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
  distance_m: number;
}

function distanceLabel(m: number) {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

const GEOFENCE_RADIUS = 300; // must be within 300m to post

export function PostScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  const [speedStatus, setSpeedStatus] = useState<SpeedTestStatus>({ kind: 'idle' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      setLocationGranted(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(loc);
      loadNearbyPlaces(loc.coords.latitude, loc.coords.longitude);
    })();
  }, []);

  const loadNearbyPlaces = useCallback(async (lat: number, lng: number) => {
    setLoadingPlaces(true);
    try {
      const { data, error } = await supabase.rpc('nearby_places', {
        user_lat: lat,
        user_lng: lng,
        radius_m: 2000,
        max_results: 30,
      });
      if (error) throw error;
      setNearbyPlaces(data ?? []);
    } catch (err) {
      console.error('Failed to load nearby places:', err);
    } finally {
      setLoadingPlaces(false);
    }
  }, []);

  const refreshLocation = async () => {
    setLoadingPlaces(true);
    setSelectedPlace(null);
    setSpeedStatus({ kind: 'idle' });
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
      await loadNearbyPlaces(loc.coords.latitude, loc.coords.longitude);
    } catch {
      setLoadingPlaces(false);
    }
  };

  const selectPlace = (place: NearbyPlace) => {
    if (place.distance_m > GEOFENCE_RADIUS) {
      Alert.alert(
        'Not Close Enough',
        `You need to be within ${GEOFENCE_RADIUS}m of ${place.name} to check in. You're currently ${distanceLabel(place.distance_m)} away.`
      );
      return;
    }
    setSelectedPlace(place);
    setSpeedStatus({ kind: 'idle' });
  };

  const startTest = async () => {
    setSpeedStatus({ kind: 'pinging' });
    await runSpeedTest(setSpeedStatus);
  };

  const canPost = selectedPlace !== null && speedStatus.kind === 'done';

  const handlePost = async () => {
    if (!canPost || speedStatus.kind !== 'done' || !selectedPlace || !location) return;

    setSubmitting(true);
    try {
      const deviceId = await getDeviceId();

      // Fresh location check — still in range?
      const freshLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const dist = getDistance(freshLoc.coords.latitude, freshLoc.coords.longitude, selectedPlace.latitude, selectedPlace.longitude);
      if (dist > GEOFENCE_RADIUS) {
        Alert.alert('Out of Range', `You've moved too far from ${selectedPlace.name}.`);
        return;
      }

      // Duplicate check
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('speed_posts')
        .select('place_id')
        .eq('device_id', deviceId)
        .eq('place_id', selectedPlace.id)
        .gte('created_at', since);

      if (recent && recent.length > 0) {
        Alert.alert('Already Posted', 'You already checked in here in the last 24 hours.');
        return;
      }

      const { error } = await supabase.from('speed_posts').insert({
        device_id: deviceId,
        place_id: selectedPlace.id,
        hotel_name: selectedPlace.name,
        download_speed: speedStatus.downloadMbps,
        upload_speed: speedStatus.uploadMbps,
        ping_ms: speedStatus.pingMs,
        latitude: freshLoc.coords.latitude,
        longitude: freshLoc.coords.longitude,
      });

      if (error) throw error;

      Alert.alert('Posted!', `Speed check-in saved for ${selectedPlace.name}.`, [
        { text: 'OK', onPress: () => { setSelectedPlace(null); setSpeedStatus({ kind: 'idle' }); } },
      ]);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const done = speedStatus.kind === 'done';

  if (!locationGranted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="location-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Location Required</Text>
          <Text style={styles.emptyText}>SavvySignal needs your location to find nearby hotels and verify check-ins.</Text>
          <TouchableOpacity style={styles.testBtn} onPress={() => Location.requestForegroundPermissionsAsync()}>
            <Text style={styles.testBtnText}>Grant Location Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Speed Check-In</Text>
            <Text style={styles.subtitle}>Select your hotel, run the test, post.</Text>
          </View>
          <TouchableOpacity onPress={refreshLocation} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Nearby places */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>NEARBY HOTELS</Text>

          {loadingPlaces ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.loadingText}>Finding nearby places...</Text>
            </View>
          ) : nearbyPlaces.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="search-outline" size={20} color={colors.textMuted} />
              <Text style={styles.emptyRowText}>No hotels found nearby. Try moving closer or refresh.</Text>
            </View>
          ) : (
            nearbyPlaces.map(place => {
              const inRange = place.distance_m <= GEOFENCE_RADIUS;
              const isSelected = selectedPlace?.id === place.id;
              return (
                <TouchableOpacity
                  key={place.id}
                  style={[styles.placeRow, isSelected && styles.placeRowSelected, !inRange && styles.placeRowFar]}
                  onPress={() => selectPlace(place)}
                >
                  <View style={styles.placeInfo}>
                    <Text style={[styles.placeName, !inRange && styles.placeNameFar]} numberOfLines={1}>
                      {place.name}
                    </Text>
                    {place.city && (
                      <Text style={styles.placeCity}>{place.city}{place.country ? `, ${place.country}` : ''}</Text>
                    )}
                  </View>
                  <View style={styles.placeRight}>
                    <Text style={[styles.placeDist, inRange ? styles.placeDistNear : styles.placeDistFar]}>
                      {distanceLabel(place.distance_m)}
                    </Text>
                    {inRange && <Ionicons name="checkmark-circle" size={14} color={colors.green} />}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Speed test — only show when place selected */}
        {selectedPlace && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>WIFI SPEED TEST</Text>
            <View style={styles.selectedBadge}>
              <Ionicons name="location" size={13} color={colors.green} />
              <Text style={styles.selectedName}>{selectedPlace.name}</Text>
            </View>

            {speedStatus.kind === 'idle' && (
              <TouchableOpacity style={styles.testBtn} onPress={startTest}>
                <Ionicons name="wifi" size={18} color="#fff" />
                <Text style={styles.testBtnText}>Run Speed Test</Text>
              </TouchableOpacity>
            )}

            {speedStatus.kind === 'pinging' && (
              <View style={styles.testingWrap}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.testingText}>Pinging nearest server...</Text>
              </View>
            )}

            {speedStatus.kind === 'downloading' && (
              <View style={styles.meterWrap}>
                <SpeedMeter speedMbps={speedStatus.speedMbps} progress={speedStatus.progress} label="DOWNLOADING" color={colors.primary} />
              </View>
            )}

            {speedStatus.kind === 'uploading' && (
              <View style={styles.meterWrap}>
                <SpeedMeter speedMbps={speedStatus.speedMbps} progress={speedStatus.progress} label="UPLOADING" color={colors.green} />
              </View>
            )}

            {done && (
              <View style={styles.resultsWrap}>
                <View style={styles.resultsRow}>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>PING</Text>
                    <Text style={styles.resultValue}>{speedStatus.pingMs} ms</Text>
                  </View>
                  <View style={styles.resultItem}>
                    <Text style={[styles.resultLabel, { color: colors.primary }]}>DOWNLOAD</Text>
                    <Text style={[styles.resultValue, { color: colors.primary }]}>{speedStatus.downloadMbps} Mbps</Text>
                  </View>
                  <View style={styles.resultItem}>
                    <Text style={[styles.resultLabel, { color: colors.green }]}>UPLOAD</Text>
                    <Text style={[styles.resultValue, { color: colors.green }]}>{speedStatus.uploadMbps} Mbps</Text>
                  </View>
                </View>
                {speedStatus.simulated && (
                  <Text style={styles.simNote}>⚠ Simulated — no internet detected</Text>
                )}
                <TouchableOpacity onPress={() => setSpeedStatus({ kind: 'idle' })} style={styles.retestBtn}>
                  <Text style={styles.retestText}>Re-run test</Text>
                </TouchableOpacity>
              </View>
            )}

            {speedStatus.kind === 'error' && (
              <View style={styles.testingWrap}>
                <Ionicons name="alert-circle" size={24} color={colors.red} />
                <Text style={styles.errorText}>{speedStatus.message}</Text>
                <TouchableOpacity onPress={startTest} style={styles.retestBtn}>
                  <Text style={styles.retestText}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Submit */}
        {canPost && (
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handlePost}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={18} color="#fff" />
                <Text style={styles.submitText}>Post Check-In</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: font.xxl, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: font.sm, color: colors.textMuted },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 },
  cardLabel: { fontSize: font.xs, fontWeight: '800', color: colors.primary, letterSpacing: 0.8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  loadingText: { fontSize: font.sm, color: colors.textMuted },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  emptyRowText: { fontSize: font.sm, color: colors.textMuted, flex: 1 },
  placeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  placeRowSelected: { borderColor: colors.green, backgroundColor: colors.greenBg },
  placeRowFar: { opacity: 0.55 },
  placeInfo: { flex: 1 },
  placeName: { fontSize: font.md, fontWeight: '700', color: colors.textPrimary },
  placeNameFar: { color: colors.textSecondary },
  placeCity: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  placeRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeDist: { fontSize: font.xs, fontWeight: '700' },
  placeDistNear: { color: colors.green },
  placeDistFar: { color: colors.textMuted },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.greenBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md },
  selectedName: { fontSize: font.sm, color: colors.green, fontWeight: '700', flex: 1 },
  testBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.lg },
  testBtnText: { fontSize: font.md, fontWeight: '800', color: '#fff' },
  testingWrap: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  testingText: { fontSize: font.sm, color: colors.textSecondary, fontWeight: '600' },
  errorText: { fontSize: font.sm, color: colors.red, textAlign: 'center' },
  meterWrap: { alignItems: 'center', paddingVertical: 12 },
  resultsWrap: { gap: 12 },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  resultItem: { alignItems: 'center', gap: 4 },
  resultLabel: { fontSize: font.xs, color: colors.textMuted, fontWeight: '800', letterSpacing: 0.5 },
  resultValue: { fontSize: font.md, fontWeight: '900', color: colors.textPrimary },
  simNote: { fontSize: font.xs, color: colors.orange, textAlign: 'center', fontWeight: '600' },
  retestBtn: { alignItems: 'center', paddingVertical: 6 },
  retestText: { fontSize: font.sm, color: colors.primary, fontWeight: '700' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.lg },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontSize: font.lg, fontWeight: '800', color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: font.xl, fontWeight: '800', color: colors.textPrimary },
  emptyText: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
