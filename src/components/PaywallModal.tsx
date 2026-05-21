import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubscribe: (priceUsd: number) => void;
  isDiscountUnlocked: boolean;
}

export function PaywallModal({ visible, onClose, onSubscribe, isDiscountUnlocked }: Props) {
  const price = isDiscountUnlocked ? 1 : 3;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.iconWrap}>
            <Ionicons name="wifi" size={36} color={colors.primary} />
          </View>

          <Text style={styles.title}>Unlock Global WiFi Intel</Text>
          <Text style={styles.subtitle}>
            Premium members see every hotel speed report worldwide — not just their own.
          </Text>

          {isDiscountUnlocked && (
            <View style={styles.discountBadge}>
              <Ionicons name="star" size={12} color={colors.green} />
              <Text style={styles.discountText}>Loyalty Reward Active — 67% Off!</Text>
            </View>
          )}

          <View style={styles.pricingRow}>
            <View style={styles.priceBox}>
              <Text style={styles.priceCurrency}>$</Text>
              <Text style={styles.priceAmount}>{price}</Text>
              <Text style={styles.pricePeriod}>/mo</Text>
            </View>
            {!isDiscountUnlocked && (
              <Text style={styles.unlockHint}>Post 10 check-ins → drop to $1/mo</Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => onSubscribe(price)}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Subscribe for ${price}/month</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Maybe later</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 20,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: font.xl,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: font.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.greenBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginBottom: 16,
  },
  discountText: {
    fontSize: font.sm,
    color: colors.green,
    fontWeight: '700',
  },
  pricingRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 2,
  },
  priceCurrency: {
    fontSize: font.lg,
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: 6,
  },
  priceAmount: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.textPrimary,
    lineHeight: 56,
  },
  pricePeriod: {
    fontSize: font.md,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 32,
  },
  unlockHint: {
    fontSize: font.sm,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  ctaBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: 12,
  },
  ctaText: {
    fontSize: font.md,
    fontWeight: '800',
    color: '#fff',
  },
  cancelBtn: {
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: font.sm,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
