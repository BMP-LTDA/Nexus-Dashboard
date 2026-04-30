import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import KPICard from '../../src/components/KPICard';
import { adsService } from '../../src/services/ads';
import { ordersService } from '../../src/services/orders';
import { PERIODS } from '../../src/lib/dateUtils';

export default function MidiaScreen() {
  const { accounts } = useAuth();
  const [period, setPeriod]     = useState('30d');
  const [ads, setAds]           = useState(null);
  const [revenue, setRevenue]   = useState(0);
  const [orders, setOrders]     = useState(0);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const slug = accounts[0]?.slug;

  const load = useCallback(async () => {
    if (!slug) return;
    const [adsData, revData] = await Promise.all([
      adsService.getAdMetrics(slug, period),
      ordersService.getRevenueMetrics(slug, period),
    ]);
    setAds(adsData);
    setRevenue(revData?.rawTotals?.net || 0);
    setOrders(revData?.rawTotals?.billed || 0);
    setLoading(false);
    setRefreshing(false);
  }, [slug, period]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const spend   = ads?.rawTotals?.spend || 0;
  const roas    = spend > 0 ? (revenue / spend).toFixed(2) + 'x' : '—';
  const cps     = orders > 0 && spend > 0 ? `R$ ${(spend / orders).toFixed(2).replace('.', ',')}` : '—';

  return (
    <ScrollView
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6366F1" />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodBar}>
        {PERIODS.map(p => (
          <TouchableOpacity key={p.key} style={[styles.chip, period === p.key && styles.chipActive]} onPress={() => setPeriod(p.key)}>
            <Text style={[styles.chipText, period === p.key && styles.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator color="#6366F1" style={{ marginTop: 48 }} /> : !ads || spend === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Sem dados de mídia</Text>
          <Text style={styles.emptyText}>Sincronize Meta Ads ou Google Ads em Configurações no dashboard web.</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.section}>Performance</Text>
          <View style={styles.grid}>
            <KPICard title="Investimento"  value={ads.kpis.totalSpend} change={ads.deltas.totalSpend.value} trend={ads.deltas.totalSpend.value > 0 ? 'up' : 'down'} color="amber" />
            <KPICard title="ROAS"          value={roas}                color="green" />
          </View>
          <View style={styles.grid}>
            <KPICard title="CPS"           value={cps}                 color="cyan"  />
            <KPICard title="CPC Médio"     value={ads.kpis.avgCpc}     change={ads.deltas.avgCpc.value} trend={ads.deltas.avgCpc.value < 0 ? 'up' : 'down'} color="blue" />
          </View>

          <Text style={styles.section}>Alcance</Text>
          <View style={styles.grid}>
            <KPICard title="Impressões"  value={ads.kpis.impressions} change={ads.deltas.impressions.value} trend={ads.deltas.impressions.value > 0 ? 'up' : 'down'} color="primary" />
            <KPICard title="Cliques"     value={ads.kpis.clicks}      change={ads.deltas.clicks.value}      trend={ads.deltas.clicks.value > 0 ? 'up' : 'down'}      color="blue"    />
          </View>
          <View style={styles.grid}>
            <KPICard title="CTR"         value={ads.kpis.ctr}         change={ads.deltas.ctr.value}         trend={ads.deltas.ctr.value > 0 ? 'up' : 'down'}         color="green"   />
            <KPICard title="Plataformas" value={`${ads.platforms?.length || 0} ativas`} color="primary" />
          </View>

          {ads.platforms?.length > 0 && (
            <>
              <Text style={styles.section}>Por Plataforma</Text>
              {ads.platforms.map(p => (
                <View key={p.platform} style={styles.platformRow}>
                  <View style={[styles.platformDot, { backgroundColor: p.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.platformName}>{p.platform}</Text>
                    <Text style={styles.platformSub}>CTR {p.ctr} · {p.clicks.toLocaleString('pt-BR')} cliques</Text>
                  </View>
                  <Text style={styles.platformSpend}>
                    R$ {Number(p.spend).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#0D0F14' },
  periodBar:    { paddingHorizontal: 16, paddingVertical: 12 },
  chip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: '#141824', borderWidth: 1, borderColor: '#252A3A', marginRight: 8 },
  chipActive:   { backgroundColor: 'rgba(99,102,241,0.15)', borderColor: '#6366F1' },
  chipText:     { color: '#64748B', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#6366F1' },
  content:      { paddingHorizontal: 16, paddingBottom: 32 },
  section:      { color: '#64748B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 10 },
  grid:         { flexDirection: 'row', gap: 10, marginBottom: 10 },
  empty:        { padding: 48, alignItems: 'center' },
  emptyTitle:   { color: '#F1F5F9', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText:    { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  platformRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#141824', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#1E2335', marginBottom: 8 },
  platformDot:  { width: 10, height: 10, borderRadius: 5 },
  platformName: { color: '#F1F5F9', fontWeight: '600', fontSize: 14 },
  platformSub:  { color: '#64748B', fontSize: 11, marginTop: 2 },
  platformSpend:{ color: '#10B981', fontWeight: '700', fontSize: 14 },
});
