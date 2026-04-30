import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Switch,
  TouchableOpacity, Alert, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/contexts/AuthContext';
import { registerForPushNotifications } from '../../src/services/pushService';

const ALERT_CONFIGS = [
  { key: 'roas_drop',       label: 'Queda de ROAS',           desc: 'ROAS abaixo de 4x',                  emoji: '📉' },
  { key: 'revenue_goal',    label: 'Meta de Receita Batida',   desc: 'Quando atingir a meta diária',        emoji: '🎯' },
  { key: 'new_order',       label: 'Novo Pedido',              desc: 'A cada pedido aprovado',              emoji: '🛍️' },
  { key: 'cancel_spike',    label: 'Pico de Cancelamentos',    desc: 'Taxa de cancelamento > 15%',          emoji: '⚠️' },
  { key: 'daily_summary',   label: 'Resumo Diário',            desc: 'Relatório às 20h todo dia',           emoji: '📊' },
  { key: 'weekly_summary',  label: 'Resumo Semanal',           desc: 'Segunda-feira às 9h com visão geral', emoji: '📅' },
];

const STORAGE_KEY = 'nexus_alert_prefs';

export default function AlertasScreen() {
  const { user } = useAuth();
  const [prefs, setPrefs]       = useState({ roas_drop: true, revenue_goal: true, new_order: false, cancel_spike: true, daily_summary: true, weekly_summary: false });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val) setPrefs(JSON.parse(val));
    });
  }, []);

  function toggle(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function handleEnablePush() {
    setRegistering(true);
    const token = await registerForPushNotifications(user?.id);
    setRegistering(false);
    if (token) {
      setPushEnabled(true);
      Alert.alert('✅ Notificações ativas', 'Você receberá alertas conforme as configurações abaixo.');
    } else {
      Alert.alert('Permissão necessária', 'Permita notificações nas configurações do dispositivo.');
    }
  }

  return (
    <ScrollView style={styles.screen}>
      {/* Push toggle */}
      <View style={styles.pushCard}>
        <View style={styles.pushInfo}>
          <Text style={styles.pushTitle}>🔔 Push Notifications</Text>
          <Text style={styles.pushSub}>
            {pushEnabled ? 'Notificações ativas neste dispositivo' : 'Toque para ativar notificações push'}
          </Text>
        </View>
        {registering
          ? <ActivityIndicator color="#6366F1" />
          : <TouchableOpacity
              style={[styles.pushBtn, pushEnabled && styles.pushBtnActive]}
              onPress={pushEnabled ? undefined : handleEnablePush}
            >
              <Text style={styles.pushBtnText}>{pushEnabled ? 'Ativo' : 'Ativar'}</Text>
            </TouchableOpacity>
        }
      </View>

      <Text style={styles.section}>Tipos de Alerta</Text>

      {ALERT_CONFIGS.map(cfg => (
        <View key={cfg.key} style={styles.row}>
          <Text style={styles.rowEmoji}>{cfg.emoji}</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>{cfg.label}</Text>
            <Text style={styles.rowDesc}>{cfg.desc}</Text>
          </View>
          <Switch
            value={prefs[cfg.key]}
            onValueChange={() => toggle(cfg.key)}
            trackColor={{ false: '#252A3A', true: 'rgba(99,102,241,0.4)' }}
            thumbColor={prefs[cfg.key] ? '#6366F1' : '#4B5568'}
          />
        </View>
      ))}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Os alertas são processados pelo servidor às 20h (BRT) e enviados automaticamente.
          A configuração "Novo Pedido" envia em tempo real via Realtime.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#0D0F14' },
  pushCard:     { margin: 16, padding: 18, backgroundColor: '#141824', borderRadius: 14, borderWidth: 1, borderColor: '#1E2335', flexDirection: 'row', alignItems: 'center', gap: 12 },
  pushInfo:     { flex: 1 },
  pushTitle:    { color: '#F1F5F9', fontWeight: '700', fontSize: 15 },
  pushSub:      { color: '#64748B', fontSize: 12, marginTop: 3 },
  pushBtn:      { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 99, backgroundColor: '#6366F1' },
  pushBtnActive:{ backgroundColor: '#1E2335', borderWidth: 1, borderColor: '#6366F1' },
  pushBtnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  section:      { color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 16, marginBottom: 8 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1F2E' },
  rowEmoji:     { fontSize: 22, width: 32, textAlign: 'center' },
  rowInfo:      { flex: 1 },
  rowLabel:     { color: '#F1F5F9', fontWeight: '600', fontSize: 14 },
  rowDesc:      { color: '#64748B', fontSize: 12, marginTop: 2 },
  infoBox:      { margin: 16, padding: 14, backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  infoText:     { color: '#8B95A8', fontSize: 12, lineHeight: 18 },
});
