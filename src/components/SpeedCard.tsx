import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SpeedPost } from '../types';
import { colors, radius, font } from '../theme';

interface Props {
  post: SpeedPost;
  isOwn?: boolean;
}

function speedLabel(dl: number): { label: string; color: string } {
  if (dl >= 100) return { label: 'Blazing Fast', color: colors.green };
  if (dl >= 50) return { label: 'Work Ready', color: colors.primary };
  if (dl >= 15) return { label: 'Streaming OK', color: colors.orange };
  return { label: 'Slow', color: colors.red };
}

export function SpeedCard({ post, isOwn = false }: Props) {
  const { label, color } = speedLabel(post.download_speed);
  const date = new Date(post.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={[styles.card, isOwn && styles.ownCard]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: color + '20' }]}>
          <Text style={[styles.badgeText, { color }]}>{post.place_type.toUpperCase()}</Text>
        </View>
        <View style={styles.row}>
          {isOwn && (
            <View style={styles.ownBadge}>
              <Text style={styles.ownBadgeText}>MY CHECK-IN</Text>
            </View>
          )}
          <Text style={styles.date}>{date}</Text>
        </View>
      </View>

      <Text style={styles.hotelName} numberOfLines={1}>{post.hotel_name}</Text>

      <View style={styles.divider} />

      <View style={styles.speeds}>
        <View style={styles.speedItem}>
          <Ionicons name="arrow-down" size={14} color={colors.primary} />
          <Text style={styles.speedValue}>{post.download_speed} Mbps</Text>
          <Text style={styles.speedLabel}>Download</Text>
        </View>

        <View style={styles.speedItem}>
          <Ionicons name="arrow-up" size={14} color={colors.green} />
          <Text style={styles.speedValue}>{post.upload_speed} Mbps</Text>
          <Text style={styles.speedLabel}>Upload</Text>
        </View>

        <View style={[styles.ratingPill, { backgroundColor: color + '15' }]}>
          <Text style={[styles.ratingText, { color }]}>{label}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Ionicons name="wifi" size={11} color={colors.textMuted} />
        <Text style={styles.pingText}>{post.ping_ms} ms ping</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  ownCard: {
    borderColor: colors.green + '40',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownBadge: {
    backgroundColor: colors.greenBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  ownBadgeText: {
    fontSize: font.xs,
    color: colors.green,
    fontWeight: '800',
  },
  date: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '600',
  },
  hotelName: {
    fontSize: font.lg,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
    opacity: 0.6,
  },
  speeds: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speedItem: {
    alignItems: 'center',
    gap: 2,
  },
  speedValue: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  speedLabel: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '600',
  },
  ratingPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  ratingText: {
    fontSize: font.xs,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border + '60',
  },
  pingText: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
