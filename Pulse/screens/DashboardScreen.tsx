import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../components/Card';
import { colors, spacing, font, radius } from '../constants/theme';
import { mockSteps, mockSleep, mockWallet, mockVitals, formatMinutes } from '../constants/mock';
import { getTodaySteps, getLastNightSleep, getVitals, Vitals } from '../constants/healthkit';
import { getBlobCount } from '../constants/blobStore';

export default function DashboardScreen() {
  const [steps, setSteps] = useState(mockSteps.today);
  const [sleep, setSleep] = useState<typeof mockSleep.last | null>(null);
  const [blobCount, setBlobCount] = useState(0);
  const [vitals, setVitals] = useState<Vitals>(mockVitals);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    console.log('[DashboardScreen] loading data...');
    try {
      const [s, sl, bc, v] = await Promise.all([getTodaySteps(), getLastNightSleep(), getBlobCount(), getVitals()]);
      console.log('[DashboardScreen] steps:', s, 'sleep mins:', sl?.totalMinutes ?? 'no data', 'blobs:', bc);
      setSteps(s);
      setSleep(sl);
      setBlobCount(bc);
      setVitals(v);
    } catch (e) {
      console.error('[DashboardScreen] error:', e);
    }
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
    const interval = setInterval(() => {
      console.log('[DashboardScreen] auto-refresh tick');
      loadData();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const progressPct = Math.min(Math.round((steps / mockSteps.goal) * 100), 100);
  const sleepScore = sleep && sleep.totalMinutes > 0
    ? Math.round(((sleep.stages.deep + sleep.stages.rem) / sleep.totalMinutes) * 100)
    : 0;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.date}>{dateStr}</Text>
          </View>
          <View style={styles.syncBadge}>
            {loading
              ? <ActivityIndicator size="small" color={colors.accent} />
              : <View style={styles.syncDot} />}
            <Text style={styles.syncText}>{loading ? 'Loading...' : 'Live data'}</Text>
          </View>
        </View>

        <Card style={styles.card} accent={colors.accent}>
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.cardLabel}>Steps Today</Text>
              <Text style={styles.cardBigNumber}>{steps.toLocaleString()}</Text>
              <Text style={styles.cardSub}>/ {mockSteps.goal.toLocaleString()} goal</Text>
            </View>
            <View style={styles.ringContainer}>
              <View style={styles.ringOuter}>
                <View style={[styles.ringInner, { borderColor: colors.border }]}>
                  <Text style={styles.ringPct}>{progressPct}%</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${progressPct}%`, backgroundColor: colors.accent }]} />
          </View>
        </Card>

        <Card style={styles.card} accent={colors.deep}>
          {!sleep ? (
            <View style={styles.noSleepRow}>
              <Text style={styles.noSleepIcon}>🌙</Text>
              <View>
                <Text style={styles.cardLabel}>Last Night</Text>
                <Text style={styles.noSleepText}>No sleep data recorded</Text>
              </View>
            </View>
          ) : (
            <>
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.cardLabel}>Last Night</Text>
              <Text style={styles.cardBigNumber}>{formatMinutes(sleep.totalMinutes)}</Text>
              <Text style={styles.cardSub}>{sleep.bedtime} → {sleep.wakeTime}</Text>
            </View>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>{sleepScore}</Text>
              <Text style={styles.scoreLabel}>score</Text>
            </View>
          </View>
          <View style={styles.stagesRow}>
            {[
              { label: 'Awake', val: sleep.stages.awake, color: colors.textMuted },
              { label: 'REM', val: sleep.stages.rem, color: colors.rem },
              { label: 'Core', val: sleep.stages.core, color: colors.core },
              { label: 'Deep', val: sleep.stages.deep, color: colors.deep },
            ].map(({ label, val, color }) => (
              <View key={label} style={styles.stagePill}>
                <View style={[styles.stageDot, { backgroundColor: color }]} />
                <Text style={styles.stageVal}>{val}m</Text>
                <Text style={styles.stageLabel}>{label}</Text>
              </View>
            ))}
          </View>
            </>
          )}
        </Card>

        <Card title="Vitals" style={styles.card}>
          <View style={styles.vitalsGrid}>
            {[
              { label: 'Resting HR', value: `${vitals.restingHeartRate}`, unit: 'bpm' },
              { label: 'HRV', value: `${vitals.hrvMs}`, unit: 'ms' },
              { label: 'VO₂max', value: `${vitals.vo2max}`, unit: '' },
              { label: 'Blood pressure', value: `${vitals.systolic}/${vitals.diastolic}`, unit: '' },
              { label: 'Blood oxygen', value: `${vitals.spo2}`, unit: '%' },
              { label: 'BMI', value: `${vitals.bmi}`, unit: '' },
            ].map((v) => (
              <View key={v.label} style={styles.vitalItem}>
                <Text style={styles.vitalValue}>{v.value}{v.unit ? <Text style={styles.vitalUnit}> {v.unit}</Text> : null}</Text>
                <Text style={styles.vitalLabel}>{v.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.storageRow}>
            <View style={styles.storageLeft}>
              <Text style={styles.cardLabel}>Walrus Storage</Text>
              <Text style={styles.storageBlobs}>{blobCount} blobs</Text>
              <Text style={styles.storageExpiry}>Testnet · Free</Text>
            </View>
            <View style={styles.walBadge}>
              <Text style={styles.walAmount}>{mockWallet.balance}</Text>
              <Text style={styles.walLabel}>WAL</Text>
            </View>
          </View>
          <View style={styles.addrRow}>
            <Text style={styles.addrLabel}>Sui Wallet</Text>
            <Text style={styles.addrValue}>0x1a2b...0b</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  greeting: { color: colors.text, fontSize: font.xl, fontWeight: '700' },
  date: { color: colors.textSecondary, fontSize: font.md, marginTop: 2 },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  syncText: { color: colors.textSecondary, fontSize: font.xs },
  card: { marginBottom: 0 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLabel: { color: colors.textSecondary, fontSize: font.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  cardBigNumber: { color: colors.text, fontSize: font.xxl, fontWeight: '700', letterSpacing: -1 },
  cardSub: { color: colors.textMuted, fontSize: font.sm, marginTop: 4 },
  ringContainer: { justifyContent: 'center' },
  ringOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 6, borderColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  ringInner: { width: 52, height: 52, borderRadius: 26, borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  ringPct: { color: colors.accent, fontSize: font.md, fontWeight: '700' },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: radius.full, marginTop: spacing.md, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: radius.full },
  scoreCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: colors.deep, justifyContent: 'center', alignItems: 'center' },
  scoreNumber: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  scoreLabel: { color: colors.textMuted, fontSize: font.xs },
  noSleepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  noSleepIcon: { fontSize: 32 },
  noSleepText: { color: colors.textMuted, fontSize: font.md, marginTop: 4 },
  stagesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  stagePill: { alignItems: 'center', gap: 4 },
  stageDot: { width: 8, height: 8, borderRadius: 4 },
  stageVal: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  stageLabel: { color: colors.textMuted, fontSize: font.xs },
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  storageLeft: {},
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  vitalItem: { width: '33.33%', paddingVertical: spacing.sm },
  vitalValue: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  vitalUnit: { color: colors.textMuted, fontSize: font.sm, fontWeight: '400' },
  vitalLabel: { color: colors.textMuted, fontSize: font.xs, marginTop: 2 },
  storageBlobs: { color: colors.text, fontSize: font.xl, fontWeight: '700', marginTop: 6 },
  storageExpiry: { color: colors.textMuted, fontSize: font.sm, marginTop: 4 },
  walBadge: { backgroundColor: colors.accentSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.accent + '44' },
  walAmount: { color: colors.accent, fontSize: font.xl, fontWeight: '700' },
  walLabel: { color: colors.accent, fontSize: font.xs, fontWeight: '600' },
  addrRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  addrLabel: { color: colors.textMuted, fontSize: font.sm },
  addrValue: { color: colors.textSecondary, fontSize: font.sm, fontFamily: 'monospace' },
});
