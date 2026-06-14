import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../components/Card';
import SleepStagesBar from '../components/SleepStagesBar';
import BarChart from '../components/BarChart';
import { colors, spacing, font, radius } from '../constants/theme';
import { mockSleep, formatMinutes } from '../constants/mock';
import { getLastNightSleep } from '../constants/healthkit';

const GOAL_MINS = 480;

export default function SleepScreen() {
  const [sleep, setSleep] = useState<typeof mockSleep.last | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[SleepScreen] loading sleep data...');
    getLastNightSleep()
      .then((data) => {
        console.log('[SleepScreen] sleep data received:', JSON.stringify(data));
        setSleep(data);
      })
      .catch((e) => console.error('[SleepScreen] error:', e))
      .finally(() => setLoading(false));
  }, []);

  const sleepScore = sleep && sleep.totalMinutes > 0
    ? Math.round(((sleep.stages.deep + sleep.stages.rem) / sleep.totalMinutes) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Sleep</Text>
          {loading && <ActivityIndicator size="small" color={colors.deep} />}
        </View>
        <Text style={styles.screenSub}>Last night</Text>

        {loading ? null : !sleep ? (
          <Card style={styles.card} accent={colors.deep}>
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataIcon}>🌙</Text>
              <Text style={styles.noDataTitle}>No Sleep Data</Text>
              <Text style={styles.noDataSub}>
                Enable Sleep tracking in the Health app or wear an Apple Watch to bed to see your sleep metrics here.
              </Text>
            </View>
          </Card>
        ) : (
          <>
            <Card style={styles.mainCard} accent={colors.deep}>
              <View style={styles.sleepHeader}>
                <View>
                  <Text style={styles.totalDuration}>{formatMinutes(sleep.totalMinutes)}</Text>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeChip}>{sleep.bedtime}</Text>
                    <Text style={styles.timeArrow}>→</Text>
                    <Text style={styles.timeChip}>{sleep.wakeTime}</Text>
                  </View>
                </View>
                <View style={[styles.scoreCircle, { borderColor: sleepScore > 70 ? colors.green : colors.orange }]}>
                  <Text style={[styles.scoreNumber, { color: sleepScore > 70 ? colors.green : colors.orange }]}>
                    {sleepScore}
                  </Text>
                  <Text style={styles.scoreLabel}>score</Text>
                </View>
              </View>
              <View style={styles.goalRow}>
                <Text style={styles.goalLabel}>
                  {sleep.totalMinutes >= GOAL_MINS
                    ? '✓ Goal reached'
                    : `${formatMinutes(GOAL_MINS - sleep.totalMinutes)} short of 8h goal`}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, {
                  width: `${Math.min((sleep.totalMinutes / GOAL_MINS) * 100, 100)}%`,
                  backgroundColor: colors.deep,
                }]} />
              </View>
            </Card>

            <Card title="Sleep Stages" style={styles.card}>
              <SleepStagesBar stages={sleep.stages} />
            </Card>

            <View style={styles.stageGrid}>
              {[
                { label: 'Deep Sleep', value: sleep.stages.deep, color: colors.deep, desc: 'Physical recovery', icon: '🌊' },
                { label: 'REM Sleep', value: sleep.stages.rem, color: colors.rem, desc: 'Memory & learning', icon: '💭' },
                { label: 'Core Sleep', value: sleep.stages.core, color: colors.core, desc: 'Light NREM', icon: '🌙' },
                { label: 'Awake', value: sleep.stages.awake, color: colors.textMuted, desc: 'Interruptions', icon: '👁' },
              ].map(({ label, value, color, desc, icon }) => (
                <View key={label} style={[styles.stageCard, { borderColor: color + '44' }]}>
                  <Text style={styles.stageIcon}>{icon}</Text>
                  <Text style={[styles.stageCardValue, { color }]}>{value}m</Text>
                  <Text style={styles.stageCardLabel}>{label}</Text>
                  <Text style={styles.stageCardDesc}>{desc}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Card title="7-Day Trend" style={styles.card}>
          <BarChart
            data={mockSleep.weekly.map((d) => ({ day: d.day, value: d.minutes }))}
            color={colors.deep}
            formatValue={formatMinutes}
          />
          <View style={styles.weeklyFooter}>
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>Avg / night</Text>
              <Text style={styles.footerValue}>{formatMinutes(mockSleep.weeklyAvg)}</Text>
            </View>
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>Goal nights</Text>
              <Text style={[styles.footerValue, { color: colors.green }]}>
                {mockSleep.weekly.filter((d) => d.minutes >= GOAL_MINS).length}/7
              </Text>
            </View>
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>Best night</Text>
              <Text style={styles.footerValue}>
                {mockSleep.weekly.find((d) => d.minutes === Math.max(...mockSleep.weekly.map((x) => x.minutes)))?.day}
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  screenTitle: { color: colors.text, fontSize: font.xxl, fontWeight: '700' },
  screenSub: { color: colors.textSecondary, fontSize: font.md, marginTop: 2, marginBottom: spacing.sm },
  mainCard: {},
  card: {},
  noDataContainer: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  noDataIcon: { fontSize: 48 },
  noDataTitle: { color: colors.text, fontSize: font.xl, fontWeight: '700' },
  noDataSub: { color: colors.textSecondary, fontSize: font.sm, textAlign: 'center', lineHeight: 20 },
  sleepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  totalDuration: { color: colors.text, fontSize: font.xxxl, fontWeight: '700', letterSpacing: -2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  timeChip: { color: colors.textSecondary, fontSize: font.sm, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  timeArrow: { color: colors.textMuted, fontSize: font.sm },
  scoreCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  scoreNumber: { fontSize: font.xl, fontWeight: '700' },
  scoreLabel: { color: colors.textMuted, fontSize: font.xs },
  goalRow: { marginTop: spacing.md },
  goalLabel: { color: colors.textSecondary, fontSize: font.sm },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: radius.full, marginTop: spacing.sm, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: radius.full },
  stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stageCard: { flex: 1, minWidth: '45%', backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, gap: 4 },
  stageIcon: { fontSize: 18 },
  stageCardValue: { fontSize: font.xl, fontWeight: '700', marginTop: 4 },
  stageCardLabel: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  stageCardDesc: { color: colors.textMuted, fontSize: font.xs },
  weeklyFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  footerItem: { alignItems: 'center', gap: 4 },
  footerLabel: { color: colors.textMuted, fontSize: font.xs },
  footerValue: { color: colors.text, fontSize: font.md, fontWeight: '600' },
});
