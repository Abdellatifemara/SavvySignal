import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
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
import { SpeedTestStatus, PlaceType } from '../types';
import { colors, radius, font } from '../theme';

const PLACE_TYPES: PlaceType[] = ['Hotel', 'Motel', 'Hostel', 'Airbnb', 'Resort', 'Other'];

const RATE_LIMIT_KEY = 'rate_limit_';

export function PostScreen() {
  const [hotelName, setHotelName] = useState('');
  const [placeType, setPlaceType] = useState<PlaceType>('Hotel');
  const [speedStatus, setSpeedStatus] = useState<SpeedTestStatus>({ kind: 'idle' });
  const [locationGranted, setLocationGranted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(status === 'granted');
    })();
  }, []);

  const startTest = async () => {
    if (!locationGranted) {
      Alert.alert('Location Required', 'We need your location to verify you\'re at the property.');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      setLocationGranted(true);
    }
    setSpeedStatus({ kind: 'pinging' });
    await runSpeedTest(setSpeedStatus);
  };

  const resetTest = () => setSpeedStatus({ kind: 'idle' });

  const canPost = hotelName.trim().length >= 2 && speedStatus.kind === 'done';

  const handlePost = async () => {
    if (!canPost || speedStatus.kind !== 'done') return;

    setSubmitting(true);
    try {
      // Get GPS
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const deviceId = await getDeviceId();

      // Anti-abuse: check duplicate in last 24h for same device + similar hotel name
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('speed_posts')
        .select('hotel_name')
        .eq('device_id', deviceId)
        .gte('created_at', since);

      const duplicate = recent?.some(
        r => r.hotel_name.toLowerCase() === hotelName.trim().toLowerCase()
      );
      if (duplicate) {
        Alert.alert('Already Posted', 'You\'ve already checked in here in the last 24 hours.');
        return;
      }

      const { error } = await supabase.from('speed_posts').insert({
        device_id: deviceId,
        hotel_name: hotelName.trim(),
        place_type: placeType,
        download_speed: speedStatus.downloadMbps,
        upload_speed: speedStatus.uploadMbps,
        ping_ms: speedStatus.pingMs,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (error) throw error;

      Alert.alert('Posted!', 'Your speed check-in has been saved.', [
        {
          text: 'OK',
          onPress: () => {
            setHotelName('');
            setSpeedStatus({ kind: 'idle' });
          },
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const done = speedStatus.kind === 'done';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Speed Check-In</Text>
        <Text style={styles.subtitle}>Test the WiFi, post your results, help fellow travelers.</Text>

        {/* Hotel Name */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PROPERTY</Text>
          <TextInput
            style={styles.input}
            value={hotelName}
            onChangeText={setHotelName}
            placeholder="e.g. Hilton Garden Inn Manhattan"
            placeholderTextColor={colors.textMuted}
            maxLength={100}
          />
          <View style={styles.typeRow}>
            {PLACE_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, placeType === t && styles.typeChipActive]}
                onPress={() => setPlaceType(t)}
              >
                <Text style={[styles.typeText, placeType === t && styles.typeTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Speed Test */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>WIFI SPEED TEST</Text>

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
              <SpeedMeter
                speedMbps={speedStatus.speedMbps}
                progress={speedStatus.progress}
                label="DOWNLOADING"
                color={colors.primary}
              />
            </View>
          )}

          {speedStatus.kind === 'uploading' && (
            <View style={styles.meterWrap}>
              <SpeedMeter
                speedMbps={speedStatus.speedMbps}
                progress={speedStatus.progress}
                label="UPLOADING"
                color={colors.green}
              />
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
                  <Text style={[styles.resultValue, { color: colors.primary }]}>
                    {speedStatus.downloadMbps} Mbps
                  </Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={[styles.resultLabel, { color: colors.green }]}>UPLOAD</Text>
                  <Text style={[styles.resultValue, { color: colors.green }]}>
                    {speedStatus.uploadMbps} Mbps
                  </Text>
                </View>
              </View>
              {speedStatus.simulated && (
                <Text style={styles.simNote}>⚠ Simulated — no internet connection detected</Text>
              )}
              <TouchableOpacity onPress={resetTest} style={styles.retestBtn}>
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

        {/* Location note */}
        <View style={styles.locationNote}>
          <Ionicons
            name={locationGranted ? 'location' : 'location-outline'}
            size={13}
            color={locationGranted ? colors.green : colors.textMuted}
          />
          <Text style={styles.locationText}>
            {locationGranted
              ? 'Location will be attached to verify your check-in'
              : 'Location permission needed to post'}
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (!canPost || submitting) && styles.submitBtnDisabled]}
          onPress={handlePost}
          disabled={!canPost || submitting}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  title: {
    fontSize: font.xxl,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: font.sm,
    color: colors.textMuted,
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
  cardLabel: {
    fontSize: font.xs,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: font.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeText: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  typeTextActive: { color: '#fff', fontWeight: '800' },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  testBtnText: {
    fontSize: font.md,
    fontWeight: '800',
    color: '#fff',
  },
  testingWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  testingText: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  errorText: {
    fontSize: font.sm,
    color: colors.red,
    textAlign: 'center',
  },
  meterWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resultsWrap: { gap: 12 },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resultItem: { alignItems: 'center', gap: 4 },
  resultLabel: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resultValue: {
    fontSize: font.md,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  simNote: {
    fontSize: font.xs,
    color: colors.orange,
    textAlign: 'center',
    fontWeight: '600',
  },
  retestBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  retestText: {
    fontSize: font.sm,
    color: colors.primary,
    fontWeight: '700',
  },
  locationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.lg,
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitText: {
    fontSize: font.lg,
    fontWeight: '800',
    color: '#fff',
  },
});
