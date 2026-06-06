import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const [competitions, setCompetitions] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const navigate = useNavigate(); // 🚀 L'outil magique de navigation !

  useEffect(() => {
    fetch('http://localhost:3000/competitions')
      .then((reponse) => {
        if (!reponse.ok) throw new Error("Problème réseau");
        return reponse.json();
      })
      .then((donnees) => {
        setCompetitions(donnees);
        setChargement(false);
      })
      .catch((err) => {
        console.error(err);
        setErreur("Impossible de joindre le serveur.");
        setChargement(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
          APP <span className="text-blue-600">SUIVI SPORT</span>
        </h1>
        <p className="text-gray-500 text-lg">Ton catalogue de compétitions en temps réel</p>
      </header>

      {erreur && (
        <div className="max-w-md mx-auto bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
          <p className="font-bold">Erreur de connexion</p>
          <p>{erreur}</p>
        </div>
      )}
      
      {chargement && !erreur && (
        <div className="flex justify-center items-center mt-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!chargement && !erreur && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {competitions.map((comp) => (
            <div 
              key={comp.competition_id} 
              // 🚀 Au clic, on navigue vers l'URL spécifique de cette compétition !
              onClick={() => navigate(`/competition/${comp.competition_id}`)}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center space-x-6 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 flex-shrink-0 bg-gray-50 rounded-xl p-2 flex justify-center items-center group-hover:scale-110 transition-transform">
                <img 
                  src={comp.logo_url} 
                  alt={`Logo ${comp.name}`} 
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                  {comp.name}
                </h2>
                <span className="inline-block mt-2 px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full">
                  Football
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;