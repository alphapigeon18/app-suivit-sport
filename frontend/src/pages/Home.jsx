import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import NotificationButton from '@/components/NotificationButton';

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
    <div className="min-h-screen bg-slate-100">
      {/* ===== Bandeau d'en-tête ===== */}
      <header className="bg-slate-900">
        <div className="max-w-6xl mx-auto px-6 py-10 sm:py-14">
          <div className="flex items-center gap-4 mb-3">
            <span className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/30">
              🏆
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              SUIVI<span className="text-emerald-400">SPORT</span>
            </h1>
          </div>
          <p className="text-slate-400 text-lg max-w-xl">
            Calendriers, scores et classements des grandes compétitions sportives,
            mis à jour en continu.
          </p>
          <NotificationButton />
        </div>
      </header>

      {/* ===== Contenu ===== */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {erreur && (
          <div className="max-w-md mx-auto bg-white border-l-4 border-red-500 text-slate-700 p-5 rounded-xl shadow-sm">
            <p className="font-bold text-red-600">Erreur de connexion</p>
            <p className="text-sm mt-1">{erreur}</p>
          </div>
        )}

        {chargement && !erreur && (
          <div className="flex justify-center items-center mt-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        )}

        {!chargement && !erreur && (
          <>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-5">
              Compétitions suivies
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {competitions.map((comp) => (
                <button
                  key={comp.competition_id}
                  onClick={() => navigate(`/competition/${comp.competition_id}`)}
                  className="group bg-white rounded-2xl ring-1 ring-slate-200 p-5 flex items-center gap-5 text-left
                             hover:ring-emerald-400 hover:shadow-xl hover:shadow-slate-200 hover:-translate-y-0.5
                             transition-all duration-200 cursor-pointer"
                >
                  <div className="w-16 h-16 shrink-0 bg-slate-50 rounded-xl p-2.5 flex justify-center items-center
                                  group-hover:scale-105 transition-transform">
                    <img
                      src={comp.logo_url}
                      alt={`Logo ${comp.name}`}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors truncate">
                      {comp.name}
                    </h3>
                    <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold uppercase tracking-wide rounded-full">
                      Football
                    </span>
                  </div>
                  <span className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all text-xl font-bold">
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
