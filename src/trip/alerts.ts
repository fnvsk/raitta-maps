import { isNativeApp } from '@/platform';

export interface TripAlert {
  at: number;
  title: string;
  body: string;
}

const FIRST_ID = 7100;
let timers: ReturnType<typeof setTimeout>[] = [];
let scheduled = 0;
let scheduledFor: unknown = null;

export const alertsSetFor = (trip: unknown) => scheduledFor === trip;

async function nativeNotifications() {
  return (await import('@capacitor/local-notifications')).LocalNotifications;
}

export async function allowTripAlerts() {
  try {
    if (isNativeApp) {
      const notifications = await nativeNotifications();
      const { display } = await notifications.checkPermissions();
      if (display !== 'granted') await notifications.requestPermissions();
    } else if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch {
  }
}

function showInBrowser({ title, body }: TripAlert) {
  navigator.vibrate?.([200, 100, 200]);

  if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png', tag: 'raitta-trip' });
  } catch {
  }
}

export async function scheduleTripAlerts(trip: unknown, alerts: TripAlert[]) {
  await cancelTripAlerts();
  scheduledFor = trip;
  const upcoming = alerts.filter((alert) => alert.at > Date.now());
  if (isNativeApp) {
    try {
      const notifications = await nativeNotifications();
      await notifications.schedule({
        notifications: upcoming.map((alert, i) => ({
          id: FIRST_ID + i,
          title: alert.title,
          body: alert.body,
          schedule: { at: new Date(alert.at), allowWhileIdle: true },
        })),
      });
      scheduled = upcoming.length;
    } catch {
    }
    return;
  }
  timers = upcoming.map((alert) => setTimeout(() => showInBrowser(alert), alert.at - Date.now()));
}

export async function cancelTripAlerts() {
  scheduledFor = null;
  timers.forEach(clearTimeout);
  timers = [];
  if (isNativeApp && scheduled) {
    const notifications = await nativeNotifications();
    await notifications.cancel({ notifications: Array.from({ length: scheduled }, (_, i) => ({ id: FIRST_ID + i })) }).catch(() => {});
    scheduled = 0;
  }
}

export function buzz() {
  navigator.vibrate?.([250, 120, 250]);
}
