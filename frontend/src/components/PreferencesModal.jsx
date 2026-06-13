import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '@/config';

function Toggle({ actif }) {
  return (
    <span
      className="relative w-10 h-6 rounded-full transition-colors shrink-0"
      style={actif ? { background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' } : { background: 'rgba(255,255,255,0.15)' }}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${actif ? 'translate-x-4' : ''}`}></span>
    </span>
  );
}

function PreferencesModal({ endpoint, onClose, onDisable }) {
  const [competitions, setCompetitions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [compsSel, setCompsSel] = useState(new Set());
  const [teamsSel, setTeamsSel] = useState(new Set());
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/competitions`).then((r) => r.json()),
      fetch(`${API_BASE_URL}/teams`).then((r) => r.json()),
      fetch(`${API_BASE_URL}/notifications/preferences?endpoint=${encodeURIComponent(endpoint)}`).then((r) => r.json()),
    ])
      .then(([comps, tms, prefs]) => {
        setCompetitions(comps);
        setTeams(tms);
        setCompsSel(new Set(prefs.competitions || []));
        setTeamsSel(new Set(prefs.teams || []));
        setChargement(false);
      })
      .catch(() => setChargement(false));
  }, [endpoint]);

  const basculer = (setter) => (id) =>
    setter((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleComp = basculer(setCompsSel);
  const toggleTeam = basculer(setTeamsSel);

  const teamsParId = useMemo(() => Object.fromEntries(teams.map((t) => [t.team_id, t])), [teams]);
  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q.length < 2) return [];
    return teams.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 25);
  }, [recherche, teams]);

  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      await fetch(`${API_BASE_URL}/notifications/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, competitions: [...compsSel], teams: [...teamsSel] }),
      });
      onClose();
    } catch (e) {
      console.error('Enregistrement préférences :', e);
      setEnregistrement(false);
    }
  };

  const aucuneAlerte = compsSel.size === 0 && teamsSel.size === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="glass-deep w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] flex flex-col text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-bold text-white text-lg">Mes alertes</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-slate-400 hover:text-white text-xl leading-none">
            ✕
          </button>
        </div>

        {chargement ? (
          <div className="py-16 flex justify-center">
            <div className="animate-spin h-8 w-8 border-b-2 border-amber-400 rounded-full"></div>
          </div>
        ) : (
          <div className="overflow-y-auto px-5 py-4 space-y-6">
            <div
              className="text-xs text-slate-400 leading-relaxed -mt-1 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              Tu es alerté à la fin d'un match si <span className="text-slate-200 font-semibold">sa compétition</span> est
              activée <span className="text-amber-400 font-semibold">ou</span> si l'une des deux équipes fait partie de tes{' '}
              <span className="text-slate-200 font-semibold">équipes suivies</span>.
              <span className="block mt-1.5 text-slate-500">
                Pour ne suivre qu'une équipe précise, décoche les compétitions et ajoute-la ci-dessous.
              </span>
            </div>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-amber-400/70 mb-3">Compétitions</h3>
              <div className="space-y-1">
                {competitions.map((c) => (
                  <button
                    key={c.competition_id}
                    onClick={() => toggleComp(c.competition_id)}
                    className="w-full flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <img src={c.logo_url} alt="" className="w-7 h-7 object-contain shrink-0" />
                    <span className="flex-1 text-left font-semibold text-slate-200 text-sm truncate">{c.name}</span>
                    <Toggle actif={compsSel.has(c.competition_id)} />
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-amber-400/70 mb-3">Équipes suivies</h3>
              {teamsSel.size > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {[...teamsSel].map(
                    (id) =>
                      teamsParId[id] && (
                        <button
                          key={id}
                          onClick={() => toggleTeam(id)}
                          className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-xs font-bold text-amber-300"
                          style={{ background: 'rgba(245,158,11,0.16)', border: '1px solid rgba(245,158,11,0.3)' }}
                        >
                          <img src={teamsParId[id].logo_url} alt="" className="w-4 h-4 object-contain" />
                          {teamsParId[id].name}
                          <span className="text-amber-400/70">✕</span>
                        </button>
                      )
                  )}
                </div>
              )}
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher une équipe…"
                className="w-full px-3 py-2 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
              {recherche.trim().length >= 2 && (
                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl divide-y divide-white/5" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                  {resultats.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-slate-400">Aucune équipe trouvée.</p>
                  ) : (
                    resultats.map((t) => (
                      <button
                        key={t.team_id}
                        onClick={() => toggleTeam(t.team_id)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-left"
                      >
                        <img src={t.logo_url} alt="" className="w-6 h-6 object-contain shrink-0" />
                        <span className="flex-1 text-sm font-medium text-slate-200 truncate">{t.name}</span>
                        {teamsSel.has(t.team_id) && <span className="text-amber-400 font-bold">✓</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </section>

            {aucuneAlerte && (
              <p className="text-xs text-amber-300 rounded-lg px-3 py-2" style={{ background: 'rgba(245,158,11,0.12)' }}>
                Aucune sélection : tu ne recevras aucune alerte.
              </p>
            )}
          </div>
        )}

        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3">
          <button onClick={onDisable} className="text-xs font-semibold text-red-400 hover:text-red-300">
            Désactiver les alertes
          </button>
          <button onClick={enregistrer} disabled={enregistrement || chargement} className="btn-accent px-5 py-2 text-sm font-bold rounded-xl disabled:opacity-60">
            {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PreferencesModal;
