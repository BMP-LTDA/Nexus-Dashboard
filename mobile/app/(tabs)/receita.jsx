import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import KPICard from '../../src/components/KPICard';
import { ordersService } from '../../src/services/orders';
import { PERIODS } from '../../src/lib/dateUtils';

export default function ReceitaScreen() {
  const { accounts } = useAuth();
  const [period, setPeriod]     = useState('30d');
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const slug = accounts[0]?.slug;

  const load = useCallback(async () => {
    if (!slug) return;
    const rev = await ordersService.getRevenueMetrics(slug, period);
    setData(rev);
    setLoading(false);
    setRefreshing(false);
  }, [slug, period]);

  useEffect(() => { setLoading(true); load(); }, [load]);

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

      {loading ? <ActivityIndicator color="#6366F1" style={{ marginTop: 48 }} /> : (
        <View style={styles.content}>
          <Text style={styles.section}>Visão Geral</Text>
          <View style={styles.grid}>
            <KPICard title="Receita Bruta"  value={data?.gross}       color="primary" />
            <KPICard title="Receita Líquida" value={data?.net}        change={data?.netChange} trend={data?.netChange >= 0 ? 'up' : 'down'} color="green" />
          </View>
          <View style={styles.grid}>
            <KPICard title="Pedidos Capturados" value={data?.captured} change={data?.capturedChange} trend={data?.capturedChange >= 0 ? 'up' : 'down'} color="blue" />
            <KPICard title="Pedidos Faturados"  value={data?.billed}   change={data?.billedChange}   trend={data?.billedChange >= 0 ? 'up' : 'down'}   color="cyan" />
          </View>

          <Text style={styles.section}>Métricas</Text>
          <View style={styles.grid}>
            <KPICard title="Ticket Médio"   value={data?.avgTicket}    change={data?.avgTicketChange} trend={data?.avgTicketChange >= 0 ? 'up' : 'down'} color="amber" />
            <KPICard title="Taxa Aprovação" value={data?.approvalRate} color="green" />
          </View>
          <View style={styles.grid}>
            <KPICard title="Cancelamentos" value={data?.cancellations} color="red" />
            <KPICard title="Em Análise"    value={data?.inAnalysis}    color="amber" />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: '#0D0F14' },
  periodBar: { paddingHorizontal: 16, paddingVertical: 12 },
  chip:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: '#141824', borderWidth: 1, borderColor: '#252A3A', marginRight: 8 },
  chipActive: { backgroundColor: 'rgba(99,102,241,0.15)', borderColor: '#6366F1' },
  chipText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#6366F1' },
  content:  { paddingHorizontal: 16, paddingBottom: 32 },
  section:  { color: '#64748B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 10 },
  grid:     { flexDirection: 'row', gap: 10, marginBottom: 10 },
});
