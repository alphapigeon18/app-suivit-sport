import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';



const traductionsPhase = { "Round of 16": "Huitièmes de finale", "Quarter-finals": "Quarts de finale", "Semi-finals": "Demi-finales", "Final": "Finale", "3rd Place Final": "Troisième place" };
const traductionsStatut = { "FINISHED": "Terminé", "IN_PLAY": "En direct", "SCHEDULED": "À venir", "POSTPONED": "Reporté" };
const traduirePhase = (p) => traductionsPhase[p] || p;
const traduireStatut = (s) => traductionsStatut[s] || s;

function CompetitionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [ligue, setLigue] = useState(null);
  const [saisons, setSaisons] = useState([]);
  const [saisonActive, setSaisonActive] = useState('');
  const [matchs, setMatchs] = useState([]);
  const [chargement, setChargement] = useState(true);
  
  const [vueActive, setVueActive] = useState('groupes');
  const [groupeActif, setGroupeActif] = useState('');

  useEffect(() => {
    fetch(`${API_BASE_URL}/competitions/${id}/matchs`)
      .then((res) => res.json())
      .then((donnees) => {
        setLigue(donnees.ligue || null);
        setSaisons(donnees.saisons || []);
        if (donnees.saisons && donnees.saisons.length > 0) setSaisonActive(donnees.saisons[0].season_id);
        setMatchs(donnees.matchs || []);
        setChargement(false);
      })
      .catch((err) => {
        console.error("Erreur backend:", err);
        setChargement(false);
      });
  }, [id]);

  // ==========================================================================
  // 🧠 L'ALGORITHME 100% BLINDÉ CONTRE LES VALEURS NULLES
  // ==========================================================================
  const { matchsPoules, matchsArbre, listeGroupes } = useMemo(() => {
    // 🛡️ Filtre intelligent : Si saisonActive existe, on filtre. Sinon, on affiche tout.
    const matchsDeLaSaison = saisonActive 
      ? matchs.filter(m => m.season_id === saisonActive) 
      : matchs;
    
    const poules = {};
    const arbre = {};
    const ordrePhases = ["Huitièmes de finale", "Quarts de finale", "Demi-finales", "Troisième place", "Finale"];

    const matchsGroupesBruts = [];
    
    // 1. Séparation classique
    matchsDeLaSaison.forEach(m => {
      let phaseBrute = m.phase || 'Phase de Groupes'; // 🛡️ Filet de sécurité
      if (phaseBrute.toLowerCase().includes('group')) {
        matchsGroupesBruts.push(m);
      } else {
        const pTrad = traduirePhase(phaseBrute);
        if (!arbre[pTrad]) arbre[pTrad] = [];
        arbre[pTrad].push(m);
      }
    });

    // 2. CLUSTERING IA (Sécurisé)
    const matriceRencontres = {};
    matchsGroupesBruts.forEach(m => {
      const h = m.home_team?.team_id; // 🛡️ Le ?. évite le crash si home_team n'existe pas
      const a = m.away_team?.team_id;
      
      if (!h || !a) return; // On saute ce match si les équipes ne sont pas encore définies
      
      if (!matriceRencontres[h]) matriceRencontres[h] = new Set();
      if (!matriceRencontres[a]) matriceRencontres[a] = new Set();
      matriceRencontres[h].add(a); matriceRencontres[a].add(h);
    });

    const equipesVisitees = new Set();
    const equipeVersGroupe = {};
    let indexLettre = 0;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    for (const eqId of Object.keys(matriceRencontres)) {
      if (!equipesVisitees.has(eqId)) {
        const nomDuGroupe = `Groupe ${alphabet[indexLettre]}`;
        indexLettre++;
        const file = [eqId];
        equipesVisitees.add(eqId);
        while (file.length > 0) {
          const courante = file.shift();
          equipeVersGroupe[courante] = nomDuGroupe;
          for (const voisin of matriceRencontres[courante]) {
            if (!equipesVisitees.has(voisin)) {
              equipesVisitees.add(voisin);
              file.push(voisin);
            }
          }
        }
      }
    }

    // 3. Rangement final (Sécurisé)
    matchsGroupesBruts.forEach(m => {
      const phaseStr = m.phase || ''; // 🛡️ Empêche le crash du .includes()
      
      let vraiGroupe = phaseStr.includes(' - ') 
        ? phaseStr.split(' - ')[0].replace('Group', 'Groupe') 
        : equipeVersGroupe[m.home_team?.team_id];
      
      if (!vraiGroupe) vraiGroupe = "Phase de Groupes";
      if (!poules[vraiGroupe]) poules[vraiGroupe] = [];
      poules[vraiGroupe].push(m);
    });

    Object.keys(poules).forEach(g => poules[g].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)));
    
    return { 
      matchsPoules: poules, 
      matchsArbre: Object.keys(arbre).sort((a, b) => ordrePhases.indexOf(a) - ordrePhases.indexOf(b)).reduce((obj, key) => { obj[key] = arbre[key]; return obj; }, {}),
      listeGroupes: Object.keys(poules).sort() 
    };
  }, [matchs, saisonActive]);

  useEffect(() => { if (listeGroupes.length > 0) setGroupeActif(listeGroupes[0]); }, [listeGroupes, saisonActive]);

  const genererClassement = (matchsDuGroupe) => {
    if (!matchsDuGroupe) return [];
    const stats = {};
    matchsDuGroupe.forEach(m => {
      // 🛡️ On s'assure que les équipes existent avant de calculer
      if (!m.home_team || !m.away_team) return;

      if (!stats[m.home_team.team_id]) stats[m.home_team.team_id] = { id: m.home_team.team_id, nom: m.home_team.name, logo: m.home_team.logo_url, pts: 0, j: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0 };
      if (!stats[m.away_team.team_id]) stats[m.away_team.team_id] = { id: m.away_team.team_id, nom: m.away_team.name, logo: m.away_team.logo_url, pts: 0, j: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0 };
      
      if (m.status === 'FINISHED') {
        stats[m.home_team.team_id].j += 1; stats[m.away_team.team_id].j += 1;
        stats[m.home_team.team_id].bp += m.home_score; stats[m.home_team.team_id].bc += m.away_score;
        stats[m.away_team.team_id].bp += m.away_score; stats[m.away_team.team_id].bc += m.home_score;
        if (m.home_score > m.away_score) { stats[m.home_team.team_id].pts += 3; stats[m.home_team.team_id].v += 1; stats[m.away_team.team_id].d += 1; }
        else if (m.home_score < m.away_score) { stats[m.away_team.team_id].pts += 3; stats[m.away_team.team_id].v += 1; stats[m.home_team.team_id].d += 1; }
        else { stats[m.home_team.team_id].pts += 1; stats[m.home_team.team_id].n += 1; stats[m.away_team.team_id].pts += 1; stats[m.away_team.team_id].n += 1; }
      }
    });
    return Object.values(stats).map(t => ({ ...t, diff: t.bp - t.bc })).sort((a, b) => { if (b.pts !== a.pts) return b.pts - a.pts; if (b.diff !== a.diff) return b.diff - a.diff; return b.bp - a.bp; });
  };
  const classementActuel = genererClassement(matchsPoules[groupeActif]);

  // ==========================================================================
  // 🎨 COMPOSANT : CARTE DE MATCH
  // ==========================================================================
  const CarteMatch = ({ m }) => {
    const homeIsWinner = m.home_winner === true || (m.home_score > m.away_score);
    const awayIsWinner = m.away_winner === true || (m.away_score > m.home_score);
    const hasPenalties = typeof m.home_penalty === 'number' && typeof m.away_penalty === 'number';
    return (
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all min-w-[260px]">
        <div className="flex justify-between items-center text-xs text-gray-400 font-bold mb-3 border-b border-gray-50 pb-2">
          <span>{new Date(m.start_time).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
          <div className="flex gap-2 items-center">
            {hasPenalties && <span className="text-orange-500 bg-orange-50 px-2 py-1 rounded-md">TAB ({m.home_penalty}-{m.away_penalty})</span>}
            <span className={`px-2 py-1 rounded-md ${m.status === 'IN_PLAY' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-600'}`}>{traduireStatut(m.status)}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={m.home_team?.logo_url} alt="logo" className="w-6 h-6 object-contain" />
              <span className={`${homeIsWinner && m.status === 'FINISHED' ? 'font-extrabold text-gray-900' : 'font-medium text-gray-500'}`}>{m.home_team?.name || 'À déterminer'}</span>
            </div>
            <span className={`${homeIsWinner ? 'font-extrabold text-gray-900' : 'font-bold text-gray-400'} text-lg`}>{m.home_score ?? '-'}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={m.away_team?.logo_url} alt="logo" className="w-6 h-6 object-contain" />
              <span className={`${awayIsWinner && m.status === 'FINISHED' ? 'font-extrabold text-gray-900' : 'font-medium text-gray-500'}`}>{m.away_team?.name || 'À déterminer'}</span>
            </div>
            <span className={`${awayIsWinner ? 'font-extrabold text-gray-900' : 'font-bold text-gray-400'} text-lg`}>{m.away_score ?? '-'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <button onClick={() => navigate('/')} className="mb-6 px-4 py-2 bg-white border rounded-lg shadow-sm font-semibold flex items-center gap-2">⬅️ Retour</button>

      {ligue && !chargement && (
        <div className="flex items-center justify-between mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-6">
            <img src={ligue.logo_url} alt={ligue.name} className="w-16 h-16 object-contain" />
            <h1 className="text-4xl font-extrabold text-gray-900">{ligue.name}</h1>
          </div>
          
          {saisons.length > 0 && (
            <select 
              value={saisonActive} 
              onChange={(e) => setSaisonActive(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold cursor-pointer"
            >
              {saisons.map(s => <option key={s.season_id} value={s.season_id}>Édition {s.year_label}</option>)}
            </select>
          )}
        </div>
      )}

      {chargement ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-b-2 border-blue-600 rounded-full"></div></div>
      ) : matchs.length === 0 ? (
        <p className="text-gray-500 bg-white p-6 rounded-xl border text-center">Aucun match programmé pour l'instant.</p>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-4 border-b border-gray-200 pb-4">
            <button onClick={() => setVueActive('groupes')} className={`px-6 py-2 text-lg font-bold rounded-full transition-colors ${vueActive === 'groupes' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}>Phase de Groupes</button>
            <button onClick={() => setVueActive('arbre')} className={`px-6 py-2 text-lg font-bold rounded-full transition-colors ${vueActive === 'arbre' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}>Phase Finale (Arbre)</button>
          </div>

          {vueActive === 'groupes' && (
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="w-full lg:w-1/3 flex flex-col gap-6">
                <div className="flex flex-wrap gap-2">
                  {listeGroupes.map(groupe => (
                    <button 
                      key={groupe} onClick={() => setGroupeActif(groupe)}
                      className={`px-3 py-1 text-sm font-bold rounded-lg transition-colors border ${groupeActif === groupe ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {groupe.replace('Groupe ', '')}
                    </button>
                  ))}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-bold text-gray-700">Classement {groupeActif}</div>
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-400 uppercase bg-white border-b">
                      <tr><th className="px-4 py-2">Équipe</th><th className="px-2 py-2 text-center">J</th><th className="px-2 py-2 text-center">DB</th><th className="px-4 py-2 text-center text-blue-600">Pts</th></tr>
                    </thead>
                    <tbody>
                      {classementActuel.map((equipe, index) => (
                        <tr key={equipe.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3 flex items-center gap-2"><span className="text-gray-400 font-bold text-xs w-3">{index + 1}</span><img src={equipe.logo} alt="logo" className="w-5 h-5 object-contain" /><span className="font-semibold text-gray-800 truncate max-w-[100px]">{equipe.nom}</span></td>
                          <td className="px-2 py-3 text-center text-gray-500">{equipe.j}</td>
                          <td className="px-2 py-3 text-center text-gray-500">{equipe.diff > 0 ? `+${equipe.diff}` : equipe.diff}</td>
                          <td className="px-4 py-3 text-center font-bold text-blue-600">{equipe.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="w-full lg:w-2/3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {matchsPoules[groupeActif]?.map(m => <CarteMatch key={m.match_id} m={m} />)}
                </div>
              </div>
            </div>
          )}

          {vueActive === 'arbre' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
              <div className="flex gap-12 min-w-max">
                {Object.entries(matchsArbre).map(([phaseName, phaseMatchs]) => (
                  <div key={phaseName} className="flex flex-col min-w-[280px]">
                    <h2 className="text-center text-sm font-extrabold text-gray-400 uppercase tracking-widest mb-6 border-b-2 border-gray-100 pb-2">{phaseName}</h2>
                    <div className="flex flex-col justify-around flex-grow space-y-6">
                      {phaseMatchs.map(m => <CarteMatch key={m.match_id} m={m} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CompetitionDetails;