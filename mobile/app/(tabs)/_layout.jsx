import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { registerForPushNotifications } from '../../src/services/pushService';

function TabIcon({ emoji, focused }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabLayout() {
  const { user, accounts } = useAuth();
  const [currentAccount, setCurrentAccount] = useState('');

  useEffect(() => {
    if (accounts.length > 0 && !currentAccount) {
      setCurrentAccount(accounts[0].slug);
    }
  }, [accounts]);

  // Registra push token ao entrar no app
  useEffect(() => {
    if (user) registerForPushNotifications(user.id);
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerStyle:    { backgroundColor: '#0D0F14', borderBottomColor: '#1E2335' },
        headerTintColor: '#F1F5F9',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        tabBarStyle:    { backgroundColor: '#0D0F14', borderTopColor: '#1E2335', height: 60 },
        tabBarActiveTintColor:   '#6366F1',
        tabBarInactiveTintColor: '#4B5568',
        tabBarLabelStyle: { fontSize: 11, marginBottom: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Painel',
          tabBarLabel: 'Painel',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
        }}
        initialParams={{ accountSlug: currentAccount }}
      />
      <Tabs.Screen
        name="receita"
        options={{
          title: 'Receita',
          tabBarLabel: 'Receita',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💰" focused={focused} />,
        }}
        initialParams={{ accountSlug: currentAccount }}
      />
      <Tabs.Screen
        name="midia"
        options={{
          title: 'Mídia',
          tabBarLabel: 'Mídia',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📢" focused={focused} />,
        }}
        initialParams={{ accountSlug: currentAccount }}
      />
      <Tabs.Screen
        name="alertas"
        options={{
          title: 'Alertas',
          tabBarLabel: 'Alertas',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔔" focused={focused} />,
        }}
        initialParams={{ accountSlug: currentAccount }}
      />
    </Tabs>
  );
}
