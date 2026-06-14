import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../components/Card';
import { colors, spacing, font, radius } from '../constants/theme';
import { mockWallet, formatAddress } from '../constants/mock';
import { syncToday, SyncStatus } from '../constants/sync';
import { getAllBlobs, getBlobCount, BlobRecord } from '../constants/blobStore';
import { syncInsuranceSummary, generateMockHealthHistory, DEMO_INSURER_PUBLIC_KEY } from '../constants/insurance';

export default function WalletScreen() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' });
  const [blobs, setBlobs] = useState<BlobRecord[]>([]);
  const [blobCount, setBlobCount] = useState(0);
  const [insState, setInsState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [insResult, setInsResult] = useState<{ blobId: string; riskBand: string; bytes: number } | null>(null);

  const loadBlobs = useCallback(async () => {
    const [all, count] = await Promise.all([getAllBlobs(), getBlobCount()]);
    setBlobs(all.slice(0, 5)); // show latest 5
    setBlobCount(count);
  }, []);

  useEffect(() => { loadBlobs(); }, [loadBlobs]);

  const handleSync = async () => {
    setSyncStatus({ state: 'syncing', step: 'Starting...' });
    await syncToday((status) => setSyncStatus(status));
    loadBlobs();
  };

  // Consolidate 30 days, encrypt the summary for the insurer's public key, and
  // store it on Walrus. Only the insurer can decrypt it (see constants/insurance).
  const handleShareInsurance = async () => {
    setInsState('working');
    try {
      const history = generateMockHealthHistory(30);
      const r = await syncInsuranceSummary(history, DEMO_INSURER_PUBLIC_KEY, {
        windowDays: 30,
        patientRef: 'pulse:demo-patient',
      });
      setInsResult({ blobId: r.blobId, riskBand: r.summary.riskBand, bytes: r.sizeBytes });
      setInsState('done');
      loadBlobs();
    } catch (e) {
      console.error('[WalletScreen] insurance share error:', e);
      setInsState('error');
    }
  };

  const handleRenew = () => {
    Alert.alert(
      'Renew Storage',
      'This will spend WAL tokens to extend blob storage for 365 more epochs. Sui wallet integration required.',
      [{ text: 'OK' }]
    );
  };

  const syncLabel = () => {
    switch (syncStatus.state) {
      case 'idle': return 'Sync Now';
      case 'syncing': return syncStatus.step;
      case 'done': return `✓ Synced ${syncStatus.sizeBytes} bytes`;
      case 'already_synced': return '✓ Already synced today';
      case 'error': return `Error — tap to retry`;
    }
  };

  const syncColor = () => {
    if (syncStatus.state === 'error') return colors.orange;
    if (syncStatus.state === 'done' || syncStatus.state === 'already_synced') return colors.green;
    return colors.accent;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Wallet</Text>
        <Text style={styles.screenSub}>Self-custody health storage</Text>

        {/* Wallet identity */}
        <Card style={styles.card} accent={colors.accent}>
          <View style={styles.walletHeader}>
            <View style={styles.walletAvatar}>
              <Text style={styles.walletAvatarText}>S</Text>
            </View>
            <View style={styles.walletInfo}>
              <Text style={styles.walletLabel}>Sui Wallet</Text>
              <Text style={styles.walletAddress}>{formatAddress(mockWallet.address)}</Text>
              <Text style={styles.walletNetwork}>Walrus Testnet</Text>
            </View>
          </View>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceValue}>{mockWallet.balance}</Text>
              <Text style={styles.balanceLabel}>WAL balance</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceValue}>{blobCount}</Text>
              <Text style={styles.balanceLabel}>Blobs stored</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={[styles.balanceValue, { color: colors.green }]}>Free</Text>
              <Text style={styles.balanceLabel}>Testnet cost</Text>
            </View>
          </View>
        </Card>

        {/* Sync */}
        <Card title="Daily Sync" style={styles.card}>
          <View style={styles.syncPipeline}>
            {[
              { label: 'HealthKit', icon: '♥', done: true },
              { label: 'FHIR R4', icon: '⬡', done: syncStatus.state === 'done' || syncStatus.state === 'already_synced' },
              { label: 'Walrus', icon: '◈', done: syncStatus.state === 'done' || syncStatus.state === 'already_synced' },
            ].map((step, i, arr) => (
              <React.Fragment key={step.label}>
                <View style={styles.pipelineStep}>
                  <View style={[styles.pipelineIcon, step.done && styles.pipelineIconDone]}>
                    <Text style={styles.pipelineIconText}>{step.icon}</Text>
                  </View>
                  <Text style={[styles.pipelineLabel, step.done && { color: colors.text }]}>{step.label}</Text>
                </View>
                {i < arr.length - 1 && (
                  <View style={[styles.pipelineArrow, step.done && { backgroundColor: colors.green }]} />
                )}
              </React.Fragment>
            ))}
          </View>

          {syncStatus.state === 'done' && (
            <View style={styles.blobResult}>
              <Text style={styles.blobResultLabel}>Blob ID</Text>
              <Text style={styles.blobResultId} numberOfLines={1}>{syncStatus.blobId}</Text>
              <Text style={styles.blobResultLabel}>Format</Text>
              <Text style={styles.blobResultValue}>FHIR R4 Bundle · {syncStatus.sizeBytes} bytes</Text>
            </View>
          )}

          {syncStatus.state === 'error' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{syncStatus.message}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.syncBtn, { backgroundColor: syncColor() }]}
            onPress={handleSync}
            disabled={syncStatus.state === 'syncing'}
          >
            <Text style={styles.syncBtnText}>{syncLabel()}</Text>
          </TouchableOpacity>
        </Card>

        {/* Insurance summary — consolidated, encrypted for the insurer only */}
        <Card title="Insurance Summary" style={styles.card}>
          <Text style={styles.insIntro}>
            Consolidate 30 days into averages + a risk band, encrypt it for the insurer, and store it on Walrus. The public blob ID reveals nothing — only the insurer can decrypt it.
          </Text>
          {insResult && (
            <View style={styles.blobResult}>
              <Text style={styles.blobResultLabel}>Risk Band</Text>
              <Text style={styles.blobResultValue}>{insResult.riskBand}</Text>
              <Text style={styles.blobResultLabel}>Encrypted Blob ID</Text>
              <Text style={styles.blobResultId} numberOfLines={1}>{insResult.blobId}</Text>
              <Text style={styles.blobResultValue}>Encrypted for insurer · {insResult.bytes} bytes</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.syncBtn, { backgroundColor: insState === 'error' ? colors.orange : insState === 'done' ? colors.green : colors.accent }]}
            onPress={handleShareInsurance}
            disabled={insState === 'working'}
          >
            <Text style={styles.syncBtnText}>
              {insState === 'working' ? 'Encrypting & uploading...'
                : insState === 'done' ? '✓ Shared with insurer'
                : insState === 'error' ? 'Error — tap to retry'
                : 'Generate & share with insurer'}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Stored blobs */}
        {blobs.length > 0 && (
          <Card title="Stored on Walrus" style={styles.card}>
            {blobs.map((blob) => (
              <View key={blob.date} style={styles.blobRow}>
                <View style={styles.blobLeft}>
                  <Text style={styles.blobDate}>{blob.date}</Text>
                  <Text style={styles.blobId} numberOfLines={1}>{blob.blobId.slice(0, 20)}...</Text>
                </View>
                <View style={styles.blobRight}>
                  <Text style={styles.blobSize}>{blob.sizeBytes}B</Text>
                  <View style={styles.blobDot} />
                </View>
              </View>
            ))}
            {blobCount > 5 && (
              <Text style={styles.moreBlobs}>+{blobCount - 5} more blobs</Text>
            )}
          </Card>
        )}

        {/* Storage health */}
        <Card title="Storage Health" style={styles.card}>
          <View style={styles.healthRow}>
            <View style={styles.healthStatus}>
              <View style={[styles.healthDot, { backgroundColor: colors.green }]} />
              <Text style={styles.healthLabel}>Testnet — Free tier</Text>
            </View>
            <TouchableOpacity style={styles.renewBtn} onPress={handleRenew}>
              <Text style={styles.renewBtnText}>Renew</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.storageDetails}>
            {[
              { label: 'Network', value: 'Walrus Testnet' },
              { label: 'Epochs per blob', value: '5 epochs' },
              { label: 'Format', value: 'FHIR R4 Bundle JSON' },
              { label: 'Aggregator', value: 'walrus-testnet.walrus.space' },
            ].map(({ label, value }) => (
              <View key={label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Permissions */}
        <Card title="Health Permissions" style={styles.card}>
          {[
            { label: 'Step Count', granted: true },
            { label: 'Sleep Analysis', granted: true },
          ].map(({ label, granted }) => (
            <View key={label} style={styles.permRow}>
              <Text style={styles.permLabel}>{label}</Text>
              <View style={[styles.permBadge, { backgroundColor: granted ? colors.greenSoft : colors.border }]}>
                <Text style={[styles.permBadgeText, { color: granted ? colors.green : colors.textMuted }]}>
                  {granted ? 'Mock' : 'Denied'}
                </Text>
              </View>
            </View>
          ))}
          <Text style={styles.permNote}>Native build required for real HealthKit access</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  screenTitle: { color: colors.text, fontSize: font.xxl, fontWeight: '700' },
  screenSub: { color: colors.textSecondary, fontSize: font.md, marginTop: 2, marginBottom: spacing.sm },
  card: {},
  walletHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  walletAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, borderWidth: 2, borderColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  walletAvatarText: { color: colors.accent, fontSize: font.xl, fontWeight: '700' },
  walletInfo: { flex: 1 },
  walletLabel: { color: colors.textSecondary, fontSize: font.sm, fontWeight: '600' },
  walletAddress: { color: colors.text, fontSize: font.lg, fontWeight: '700', fontFamily: 'monospace', marginTop: 2 },
  walletNetwork: { color: colors.accent, fontSize: font.xs, marginTop: 2 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  balanceItem: { alignItems: 'center', gap: 4 },
  balanceValue: { color: colors.text, fontSize: font.xl, fontWeight: '700' },
  balanceLabel: { color: colors.textMuted, fontSize: font.xs },
  balanceDivider: { width: 1, backgroundColor: colors.border },
  syncPipeline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  pipelineStep: { alignItems: 'center', gap: 6 },
  pipelineIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  pipelineIconDone: { backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: colors.green },
  pipelineIconText: { fontSize: 18 },
  pipelineLabel: { color: colors.textMuted, fontSize: font.xs, fontWeight: '600' },
  pipelineArrow: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: spacing.sm, marginBottom: spacing.lg },
  blobResult: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, gap: 4 },
  blobResultLabel: { color: colors.textMuted, fontSize: font.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  blobResultId: { color: colors.accent, fontSize: font.sm, fontFamily: 'monospace', marginBottom: spacing.sm },
  blobResultValue: { color: colors.textSecondary, fontSize: font.sm },
  insIntro: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 19, marginBottom: spacing.md },
  errorBox: { backgroundColor: colors.orangeSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.orange + '44' },
  errorText: { color: colors.orange, fontSize: font.sm },
  syncBtn: { paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  syncBtnText: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  blobRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  blobLeft: { flex: 1, gap: 2 },
  blobDate: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  blobId: { color: colors.textMuted, fontSize: font.xs, fontFamily: 'monospace' },
  blobRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blobSize: { color: colors.textSecondary, fontSize: font.xs },
  blobDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  moreBlobs: { color: colors.textMuted, fontSize: font.xs, textAlign: 'center', marginTop: spacing.sm },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  healthStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  healthDot: { width: 10, height: 10, borderRadius: 5 },
  healthLabel: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  renewBtn: { backgroundColor: colors.accentSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.accent + '44' },
  renewBtnText: { color: colors.accent, fontSize: font.sm, fontWeight: '600' },
  storageDetails: { gap: spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  detailLabel: { color: colors.textMuted, fontSize: font.sm },
  detailValue: { color: colors.textSecondary, fontSize: font.sm, fontWeight: '500' },
  permRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  permLabel: { color: colors.text, fontSize: font.md },
  permBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  permBadgeText: { fontSize: font.xs, fontWeight: '600' },
  permNote: { color: colors.textMuted, fontSize: font.xs, marginTop: spacing.md, fontStyle: 'italic' },
});
