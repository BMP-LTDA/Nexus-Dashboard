import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configura como as notificações aparecem quando o app está em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId) {
  if (!Device.isDevice) {
    console.log('[push] Emulador detectado — push ignorado');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[push] Permissão negada pelo usuário');
    return null;
  }

  // Canal Android (obrigatório para Android 8+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('nexus-alerts', {
      name: 'Alertas Nexus',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Salva token no Supabase — upsert garante sem duplicatas
  const { error } = await supabase.from('push_tokens').upsert(
    { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
    { onConflict: 'token' }
  );

  if (error) console.error('[push] Erro ao salvar token:', error.message);
  else console.log('[push] Token registrado:', token);

  return token;
}
