import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, font, spacing, radius } from '../constants/theme';

interface Bar {
  day: string;
  value: number;
}

interface Props {
  data: Bar[];
  color?: string;
  highlightLast?: boolean;
  unit?: string;
  formatValue?: (v: number) => string;
}

export default function BarChart({ data, color = colors.accent, highlightLast = true, formatValue }: Props) {
  const max = Math.max(...data.map((d) => d.value));

  return (
    <View style={styles.container}>
      {data.map((item, i) => {
        const isLast = i === data.length - 1;
        const barColor = highlightLast && isLast ? color : `${color}66`;
        const heightPct = max > 0 ? item.value / max : 0;

        return (
          <View key={item.day} style={styles.barWrapper}>
            {isLast && (
              <Text style={[styles.topLabel, { color }]}>
                {formatValue ? formatValue(item.value) : item.value.toLocaleString()}
              </Text>
            )}
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(heightPct * 100, 4)}%`,
                    backgroundColor: barColor,
                  },
                ]}
              />
            </View>
            <Text style={[styles.dayLabel, isLast && { color: colors.text }]}>
              {item.day}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    gap: 6,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: radius.sm,
  },
  dayLabel: {
    color: colors.textMuted,
    fontSize: font.xs,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  topLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
});
