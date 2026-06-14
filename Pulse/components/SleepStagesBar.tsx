import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, font, spacing, radius } from '../constants/theme';

interface Stages {
  awake: number;
  rem: number;
  core: number;
  deep: number;
}

interface Props {
  stages: Stages;
}

const STAGE_CONFIG = [
  { key: 'awake' as const, label: 'Awake', color: colors.awake },
  { key: 'rem' as const, label: 'REM', color: colors.rem },
  { key: 'core' as const, label: 'Core', color: colors.core },
  { key: 'deep' as const, label: 'Deep', color: colors.deep },
];

const fmt = (mins: number) => {
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export default function SleepStagesBar({ stages }: Props) {
  const total = stages.awake + stages.rem + stages.core + stages.deep;

  return (
    <View>
      <View style={styles.bar}>
        {STAGE_CONFIG.map(({ key, color }) => (
          <View
            key={key}
            style={[
              styles.segment,
              {
                flex: stages[key],
                backgroundColor: color,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.legend}>
        {STAGE_CONFIG.map(({ key, label, color }) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{label}</Text>
            <Text style={styles.legendValue}>{fmt(stages[key])}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.full,
    overflow: 'hidden',
    gap: 2,
  },
  segment: {
    borderRadius: radius.full,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: colors.textSecondary,
    fontSize: font.xs,
  },
  legendValue: {
    color: colors.text,
    fontSize: font.sm,
    fontWeight: '600',
  },
});
