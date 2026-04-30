import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const COLORS = {
  primary: '#6366F1', blue: '#3B82F6', green: '#10B981',
  amber: '#F59E0B', red: '#EF4444', cyan: '#06B6D4',
};

export default function KPICard({ title, value, change, trend, color = 'primary' }) {
  const accent = COLORS[color] || COLORS.primary;
  const isUp   = trend === 'up';
  const isDown = trend === 'down';
  const changeColor = isUp ? '#10B981' : isDown ? '#EF4444' : '#64748B';
  const changeSign  = change > 0 ? '+' : '';

  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value ?? '—'}
      </Text>
      {change !== undefined && change !== null && (
        <Text style={[styles.change, { color: changeColor }]}>
          {isUp ? '↑' : isDown ? '↓' : '→'} {changeSign}{typeof change === 'number' ? change.toFixed(1) : change}%
          <Text style={styles.changeSub}> vs. anterior</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141824', borderRadius: 12,
    padding: 16, borderLeftWidth: 3,
    borderWidth: 1, borderColor: '#1E2335',
    flex: 1, minWidth: '45%',
  },
  title:  { color: '#64748B', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  value:  { color: '#F1F5F9', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  change: { fontSize: 12, fontWeight: '600' },
  changeSub: { color: '#64748B', fontWeight: '400' },
});
