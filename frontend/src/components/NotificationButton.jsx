import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/config';

// Convertit la clé VAPID (base64 url) en Uint8Array attendu par pushManager
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const supporte = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function NotificationButton() {
  // 'verif' | 'non-supporte' | 'desactive' | 'active' | 'refuse' | 'chargement'
  const [etat, setEtat] = useState('verif');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supporte()) {
      setEtat('non-supporte');
      return;
    }
    if (Notification.permission === 'denied') {
      setEtat('refuse');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEtat(sub ? 'active' : 'desactive'))
      .catch(() => setEtat('desactive'));
  }, []);

  const activer = async () => {
    setMessage('');
    setEtat('chargement');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setEtat(permission === 'denied' ? 'refuse' : 'desactive');
        return;
      }

      const rep = await fetch(`${API_BASE_URL}/notifications/vapid-public-key`);
      if (!rep.ok) throw new Error('clé indisponible');
      const { publicKey } = await rep.json();

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const envoi = await fetch(`${API_BASE_URL}/notifications/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      if (!envoi.ok) throw new Error('enregistrement échoué');

      setEtat('active');
    } catch (erreur) {
      console.error('Activation notifications :', erreur);
      setMessage("L'activation a échoué. Sur iPhone, l'app doit d'abord être installée sur l'écran d'accueil.");
      setEtat('desactive');
    }
  };

  const desactiver = async () => {
    setEtat('chargement');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${API_BASE_URL}/notifications/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEtat('desactive');
    } catch (erreur) {
      console.error('Désactivation notifications :', erreur);
      setEtat('active');
    }
  };

  if (etat === 'verif' || etat === 'non-supporte') return null;

  if (etat === 'refuse') {
    return (
      <p className="text-xs text-slate-400 mt-3">
        🔕 Notifications bloquées dans les réglages du navigateur.
      </p>
    );
  }

  const active = etat === 'active';

  return (
    <div className="mt-4">
      <button
        onClick={active ? desactiver : activer}
        disabled={etat === 'chargement'}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 ${
          active
            ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/25'
            : 'bg-emerald-500 text-white hover:bg-emerald-400'
        }`}
      >
        {etat === 'chargement' ? (
          <>
            <span className="w-4 h-4 border-2 border-current border-b-transparent rounded-full animate-spin"></span>
            Patiente…
          </>
        ) : active ? (
          <>🔔 Alertes de fin de match activées</>
        ) : (
          <>🔔 M'alerter à la fin des matchs</>
        )}
      </button>
      {message && <p className="text-xs text-amber-300/90 mt-2 max-w-sm">{message}</p>}
    </div>
  );
}

export default NotificationButton;
