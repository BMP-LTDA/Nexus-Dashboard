import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import KPICard from '../../src/components/KPICard';
import { ordersService } from '../../src/services/orders';
import { adsService } from '../../src/services/ads';
import { PERIODS } from '../../src/lib/dateUtils';

export default function OverviewScreen() {
  const { accounts, signOut } = useAuth();
  const [accountIdx, setAccountIdx] = useState(0);
  const [period, setPeriod]         = useState('30d');
  const [kpis, setKpis]             = useState(null);
  const [adKpis, setAdKpis]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const slug = accounts[accountIdx]?.slug;

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const [rev, ret, ads] = await Promise.all([
        ordersService.getRevenueMetrics(slug, period),
        ordersService.getRetentionMetrics(slug, period),
        adsService.getAdMetrics(slug, period),
      ]);
      setKpis({ rev, ret });
      setAdKpis(ads);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug, period]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const roasVal = adKpis && kpis?.rev
    ? (adKpis.rawTotals.spend > 0
        ? (kpis.rev.rawTotals.net / adKpis.rawTotals.spend).toFixed(2) + 'x'
        : '—')
    : '—';

  return (
    <ScrollView
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6366F1" />}
    >
      {/* Account picker */}
      {accounts.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountBar}>
          {accounts.map((a, i) => (
            <TouchableOpacity
              key={a.slug}
              style={[styles.accountChip, i === accountIdx && styles.accountChipActive]}
              onPress={() => setAccountIdx(i)}
            >
              <Text style={[styles.accountChipText, i === accountIdx && styles.accountChipTextActive]}>
                {a.icon || '🏪'} {a.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Period picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodBar}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodChip, period === p.key && styles.periodChipActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#6366F1" style={{ marginTop: 48 }} />
      ) : (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Receita</Text>
          <View style={styles.kpiGrid}>
            <KPICard title="Receita Total"  value={kpis?.rev?.net}       change={kpis?.rev?.netChange}       trend={kpis?.rev?.netChange >= 0 ? 'up' : 'down'}       color="primary" />
            <KPICard title="Pedidos"        value={kpis?.rev?.billed}    change={kpis?.rev?.billedChange}    trend={kpis?.rev?.billedChange >= 0 ? 'up' : 'down'}    color="blue"    />
          </View>
          <View style={styles.kpiGrid}>
            <KPICard title="Ticket Médio"   value={kpis?.rev?.avgTicket} change={kpis?.rev?.avgTicketChange} trend={kpis?.rev?.avgTicketChange >= 0 ? 'up' : 'down'} color="green"   />
            <KPICard title="Aprovação"      value={kpis?.rev?.approvalRate} color="cyan" />
          </View>

          <Text style={styles.sectionTitle}>Clientes</Text>
          <View style={styles.kpiGrid}>
            <KPICard title="Novos Clientes"    value={kpis?.ret?.newCustomers}       change={kpis?.ret?.newCustomersChange}       trend={kpis?.ret?.newCustomersChange >= 0 ? 'up' : 'down'}       color="green" />
            <KPICard title="Recorrentes"       value={kpis?.ret?.returningCustomers} change={kpis?.ret?.returningCustomersChange} trend={kpis?.ret?.returningCustomersChange >= 0 ? 'up' : 'down'} color="primary" />
          </View>
          <View style={styles.kpiGrid}>
            <KPICard title="Taxa Retenção" value={kpis?.ret?.retentionRate} change={kpis?.ret?.retentionRateChange} trend={kpis?.ret?.retentionRateChange >= 0 ? 'up' : 'down'} color="amber" />
            <KPICard title="LTV"           value={kpis?.ret?.ltv} color="blue" />
          </View>

          {adKpis && adKpis.rawTotals.spend > 0 && (
            <>
              <Text style={styles.sectionTitle}>Mídia Paga</Text>
              <View style={styles.kpiGrid}>
                <KPICard title="Investimento" value={adKpis.kpis.totalSpend} change={adKpis.deltas.totalSpend.value} trend={adKpis.deltas.totalSpend.value > 0 ? 'up' : 'down'} color="amber" />
                <KPICard title="ROAS" value={roasVal} color="green" />
              </View>
            </>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#0D0F14' },
  accountBar:  { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  accountChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: '#141824', borderWidth: 1, borderColor: '#252A3A', marginRight: 8 },
  accountChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  accountChipText:   { color: '#64748B', fontSize: 13, fontWeight: '600' },
  accountChipTextActive: { color: '#fff' },
  periodBar:   { paddingHorizontal: 16, paddingVertical: 8 },
  periodChip:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: '#141824', borderWidth: 1, borderColor: '#252A3A', marginRight: 8 },
  periodChipActive: { backgroundColor: 'rgba(99,102,241,0.15)', borderColor: '#6366F1' },
  periodText:  { color: '#64748B', fontSize: 12, fontWeight: '600' },
  periodTextActive: { color: '#6366F1' },
  content:     { paddingHorizontal: 16, paddingBottom: 32 },
  sectionTitle: { color: '#64748B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 10 },
  kpiGrid:     { flexDirection: 'row', gap: 10, marginBottom: 10 },
  signOut:     { margin: 16, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#252A3A', alignItems: 'center' },
  signOutText: { color: '#64748B', fontWeight: '600' },
});
