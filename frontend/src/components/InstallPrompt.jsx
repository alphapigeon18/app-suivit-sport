import { useState, useEffect } from 'react';

const CLE_REJET = 'pwa-install-dismissed';
const DELAI_REJET = 7 * 24 * 60 * 60 * 1000; // on ne le re-propose pas avant 7 jours

const estIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const estInstallee = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const rejetRecent = () => {
  const t = Number(localStorage.getItem(CLE_REJET) || 0);
  return Date.now() - t < DELAI_REJET;
};

function InstallPrompt() {
  const [promptDiffere, setPromptDiffere] = useState(null);
  const [afficherIOS, setAfficherIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (estInstallee() || rejetRecent()) return;

    // Android / Chrome / Edge : on capture l'événement natif
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setPromptDiffere(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // L'app vient d'être installée : on masque le bandeau
    const onInstalled = () => setVisible(false);
    window.addEventListener('appinstalled', onInstalled);

    // iOS : pas d'événement natif, on affiche les instructions manuelles
    if (estIOS()) {
      setAfficherIOS(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const fermer = () => {
    setVisible(false);
    localStorage.setItem(CLE_REJET, String(Date.now()));
  };

  const installer = async () => {
    if (!promptDiffere) return;
    promptDiffere.prompt();
    await promptDiffere.userChoice;
    setPromptDiffere(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 pointer-events-none">
      <div className="pointer-events-auto max-w-md mx-auto bg-slate-900 text-white rounded-2xl shadow-2xl ring-1 ring-white/10 p-4 flex items-start gap-4">
        <span className="w-11 h-11 shrink-0 rounded-xl bg-emerald-500 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/30">
          ⚽
        </span>

        <div className="flex-1 min-w-0">
          {afficherIOS ? (
            <>
              <p className="font-bold text-sm">Installer l'application</p>
              <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                Appuie sur <span className="font-semibold text-white">Partager</span>{' '}
                <span className="inline-block align-middle">⬆️</span> en bas de Safari, puis sur{' '}
                <span className="font-semibold text-white">« Sur l'écran d'accueil »</span>.
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-sm">Installer SuiviSport</p>
              <p className="text-slate-300 text-xs mt-1">
                Accès rapide depuis ton écran d'accueil, en plein écran.
              </p>
              <button
                onClick={installer}
                className="mt-2.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold rounded-lg transition-colors"
              >
                Installer
              </button>
            </>
          )}
        </div>

        <button
          onClick={fermer}
          aria-label="Fermer"
          className="shrink-0 text-slate-400 hover:text-white text-lg leading-none transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default InstallPrompt;
