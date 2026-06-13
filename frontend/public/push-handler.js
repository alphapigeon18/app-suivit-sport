// Gestion des notifications push, importé par le service worker de l'app
// (via workbox.importScripts dans vite.config.js).
// Affiche la notification reçue et ouvre l'app au clic.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'SuiviSport', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'SuiviSport';
  const options = {
    body: data.body || '',
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: { url: data.url },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const cible = event.notification.data && event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      // Si une fenêtre de l'app est déjà ouverte, on la met au premier plan
      for (const fenetre of fenetres) {
        if ('focus' in fenetre) {
          if (cible) fenetre.navigate(cible).catch(() => {});
          return fenetre.focus();
        }
      }
      if (cible && clients.openWindow) return clients.openWindow(cible);
    })
  );
});
