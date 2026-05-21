import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, font } from '../theme';

interface Props {
  speedMbps: number;
  progress: number;
  label: string;
  color: string;
}

export function SpeedMeter({ speedMbps, progress, label, color }: Props) {
  const animProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animProgress, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={styles.container}>
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: colors.track }]}>
        <View style={[styles.progressRing, {
          width: size - strokeWidth,
          height: size - strokeWidth,
          borderRadius: (size - strokeWidth) / 2,
          borderColor: color,
          borderTopColor: progress > 0.75 ? color : 'transparent',
          borderRightColor: progress > 0.25 ? color : 'transparent',
          borderBottomColor: progress > 0.5 ? color : 'transparent',
          borderLeftColor: color,
          transform: [{ rotate: '-90deg' }],
          opacity: progress,
        }]} />
        <View style={styles.center}>
          <Text style={[styles.speed, { color }]}>{speedMbps.toFixed(1)}</Text>
          <Text style={styles.unit}>Mbps</Text>
        </View>
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  ring: {
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRing: {
    position: 'absolute',
    borderWidth: 8,
  },
  center: {
    alignItems: 'center',
  },
  speed: {
    fontSize: font.xl,
    fontWeight: '900',
  },
  unit: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '700',
  },
  label: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
