import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../components/Card';
import StepRing from '../components/StepRing';
import BarChart from '../components/BarChart';
import { colors, spacing, font } from '../constants/theme';
import { mockSteps } from '../constants/mock';
import { getTodaySteps, getHourlySteps, getWeeklySteps } from '../constants/healthkit';

export default function StepsScreen() {
  const [steps, setSteps] = useState(mockSteps.today);
  const [hourly, setHourly] = useState(mockSteps.hourly);
  const [weekly, setWeekly] = useState(mockSteps.weekly);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    console.log('[StepsScreen] loading health data...');
    try {
      const [s, h, w] = await Promise.all([getTodaySteps(), getHourlySteps(), getWeeklySteps()]);
      console.log('[StepsScreen] steps:', s, 'active hours:', h.filter(x => x > 0).length, 'weekly days:', w.length);
      setSteps(s);
      setHourly(h);
      setWeekly(w);
    } catch (e) {
      console.error('[StepsScreen] error:', e);
    }
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
    const interval = setInterval(() => {
      console.log('[StepsScreen] auto-refresh tick');
      loadData();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const peakHour = hourly.indexOf(Math.max(...hourly));
  const peakLabel = peakHour < 12 ? `${peakHour}AM` : peakHour === 12 ? '12PM' : `${peakHour - 12}PM`;
  const activeHours = hourly.filter((s) => s > 0).length;
  const weeklyAvg = Math.round(weekly.reduce((sum, d) => sum + d.steps, 0) / (weekly.filter(d => d.steps > 0).length || 1));
  const bestDay = weekly.reduce((best, d) => d.steps > best.steps ? d : best, weekly[0]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Steps</Text>
          {loading && <ActivityIndicator size="small" color={colors.accent} />}
        </View>
        <Text style={styles.screenSub}>Today</Text>

        <Card style={styles.ringCard} accent={colors.accent}>
          <StepRing steps={steps} goal={mockSteps.goal} size={200} />
          <View style={styles.ringStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{activeHours}</Text>
              <Text style={styles.statLabel}>Active hours</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{peakLabel}</Text>
              <Text style={styles.statLabel}>Peak hour</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{(steps * 0.0008).toFixed(1)} km</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
          </View>
        </Card>

        <Card title="Hourly Activity" style={styles.card}>
          <View style={styles.hourlyChart}>
            {hourly.slice(6, 22).map((val, i) => {
              const max = Math.max(...hourly) || 1;
              const h = (val / max) * 60;
              return (
                <View key={i} style={styles.hourlyBarWrap}>
                  <View style={[styles.hourlyBar, { height: Math.max(h, 2), backgroundColor: val > 500 ? colors.accent : colors.border }]} />
                </View>
              );
            })}
          </View>
          <View style={styles.hourlyLabels}>
            <Text style={styles.hourlyLabel}>6AM</Text>
            <Text style={styles.hourlyLabel}>12PM</Text>
            <Text style={styles.hourlyLabel}>6PM</Text>
            <Text style={styles.hourlyLabel}>10PM</Text>
          </View>
        </Card>

        <Card title="This Week" style={styles.card}>
          <BarChart
            data={weekly.map((d) => ({ day: d.day, value: d.steps }))}
            color={colors.accent}
            formatValue={(v) => `${(v / 1000).toFixed(1)}k`}
          />
          <View style={styles.weeklyFooter}>
            <View style={styles.weeklyFooterItem}>
              <Text style={styles.footerLabel}>Weekly avg</Text>
              <Text style={styles.footerValue}>{weeklyAvg.toLocaleString()}</Text>
            </View>
            <View style={styles.weeklyFooterItem}>
              <Text style={styles.footerLabel}>Best day</Text>
              <Text style={styles.footerValue}>{bestDay?.day ?? '—'}</Text>
            </View>
            <View style={styles.weeklyFooterItem}>
              <Text style={styles.footerLabel}>Goal hit</Text>
              <Text style={[styles.footerValue, { color: colors.green }]}>
                {weekly.filter((d) => d.steps >= mockSteps.goal).length}/7
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
  ringCard: { alignItems: 'center', gap: spacing.lg },
  card: {},
  ringStats: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', paddingTop: spacing.sm },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  statLabel: { color: colors.textMuted, fontSize: font.xs },
  statDivider: { width: 1, height: 36, backgroundColor: colors.border },
  hourlyChart: { flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 3 },
  hourlyBarWrap: { flex: 1, justifyContent: 'flex-end' },
  hourlyBar: { borderRadius: 2, width: '100%' },
  hourlyLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  hourlyLabel: { color: colors.textMuted, fontSize: font.xs },
  weeklyFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  weeklyFooterItem: { alignItems: 'center', gap: 4 },
  footerLabel: { color: colors.textMuted, fontSize: font.xs },
  footerValue: { color: colors.text, fontSize: font.md, fontWeight: '600' },
});
