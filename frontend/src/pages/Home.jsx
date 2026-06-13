import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import NotificationButton from '@/components/NotificationButton';

const degradeAmbre = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 60%, #ea580c 100%)';

function Home() {
  const [competitions, setCompetitions] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE_URL}/competitions`)
      .then((reponse) => {
        if (!reponse.ok) throw new Error('Problème réseau');
        return reponse.json();
      })
      .then((donnees) => {
        setCompetitions(donnees);
        setChargement(false);
      })
      .catch((err) => {
        console.error(err);
        setErreur('Impossible de joindre le serveur.');
        setChargement(false);
      });
  }, []);

  return (
    <div className="min-h-dvh">
      {/* ===== Hero ===== */}
      <header className="max-w-6xl mx-auto px-6 pt-12 sm:pt-16 pb-8">
        <div className="flex items-center gap-4 mb-4">
          <span
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: degradeAmbre, boxShadow: '0 10px 30px rgba(245,158,11,0.45)' }}
          >
            🏆
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
            SUIVI<span className="text-gradient">SPORT</span>
          </h1>
        </div>
        <p className="text-slate-300/80 text-lg max-w-xl leading-relaxed">
          Calendriers, scores et classements des grandes compétitions sportives, mis à jour en continu.
        </p>
        <NotificationButton />
      </header>

      {/* ===== Contenu ===== */}
      <main className="max-w-6xl mx-auto px-6 pb-16">
        {erreur && (
          <div className="glass max-w-md mx-auto p-5 border-l-2" style={{ borderLeftColor: '#ef4444' }}>
            <p className="font-bold text-red-400">Erreur de connexion</p>
            <p className="text-sm mt-1 text-slate-300">{erreur}</p>
          </div>
        )}

        {chargement && !erreur && (
          <div className="flex justify-center items-center mt-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400"></div>
          </div>
        )}

        {!chargement && !erreur && (
          <>
            <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400/70 mb-5">
              Compétitions suivies
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {competitions.map((comp) => (
                <button
                  key={comp.competition_id}
                  onClick={() => navigate(`/competition/${comp.competition_id}`)}
                  className="group glass hoverable p-5 flex items-center gap-5 text-left cursor-pointer"
                >
                  <div
                    className="w-16 h-16 shrink-0 rounded-xl p-2.5 flex justify-center items-center"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <img src={comp.logo_url} alt={`Logo ${comp.name}`} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                      {comp.name}
                    </h3>
                    <span
                      className="inline-block mt-1.5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-full"
                      style={{ background: 'rgba(245,158,11,0.14)', color: '#fcd34d' }}
                    >
                      Football
                    </span>
                  </div>
                  <span className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all text-xl font-bold">
                    →
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default Home;
