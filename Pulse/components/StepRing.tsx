import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, font } from '../constants/theme';

interface Props {
  steps: number;
  goal: number;
  size?: number;
}

export default function StepRing({ steps, goal, size = 200 }: Props) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(steps / goal, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={colors.accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={styles.inner}>
        <Text style={styles.steps}>{steps.toLocaleString()}</Text>
        <Text style={styles.label}>steps</Text>
        <Text style={styles.goal}>/ {goal.toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  svg: {},
  inner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: {
    color: colors.text,
    fontSize: font.xxl,
    fontWeight: '700',
    letterSpacing: -1,
  },
  label: {
    color: colors.textSecondary,
    fontSize: font.sm,
    marginTop: 2,
  },
  goal: {
    color: colors.textMuted,
    fontSize: font.xs,
    marginTop: 2,
  },
});
