import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

// ============================================================================
// 🌍 TRADUCTIONS
// ============================================================================
const traductionsPhase = {
  'Round of 64': '64èmes de finale',
  'Round of 32': 'Seizièmes de finale',
  'Round of 16': 'Huitièmes de finale',
  'Play-offs': 'Barrages',
  'Quarter-finals': 'Quarts de finale',
  'Semi-finals': 'Demi-finales',
  'Final': 'Finale',
  '3rd Place Final': 'Troisième place',
};
const traductionsStatut = { FINISHED: 'Terminé', IN_PLAY: 'En direct', SCHEDULED: 'À venir', POSTPONED: 'Reporté' };
const ordrePhases = ['64èmes de finale', 'Seizièmes de finale', 'Barrages', 'Huitièmes de finale', 'Quarts de finale', 'Demi-finales', 'Troisième place', 'Finale'];

const traduirePhase = (p) => {
  const journee = /^(Regular Season|League Stage) - (\d+)$/.exec(p);
  if (journee) return `Journée ${journee[2]}`;
  return traductionsPhase[p] || p;
};
const traduireStatut = (s) => traductionsStatut[s] || s;

const estPhaseFinale = (phaseTrad) => ordrePhases.includes(phaseTrad);

// Tri des journées par numéro
const comparerJournees = (a, b) => {
  const na = Number(/(\d+)/.exec(a)?.[1] ?? 1e9);
  const nb = Number(/(\d+)/.exec(b)?.[1] ?? 1e9);
  return na - nb;
};

const parDate = (a, b) => new Date(a.start_time) - new Date(b.start_time);

// ============================================================================
// 🛡️ LOGO D'ÉQUIPE (avec remplacement propre si logo absent ou cassé)
// ============================================================================
function TeamLogo({ equipe, taille = 'w-6 h-6' }) {
  const [enErreur, setEnErreur] = useState(false);
  const inconnue = !equipe || equipe.name === 'À déterminer' || !equipe.logo_url || enErreur;

  if (inconnue) {
    return (
      <span
        className={`${taille} shrink-0 rounded-full border-2 border-dashed border-slate-300 bg-slate-50
                    flex items-center justify-center text-slate-300 text-[10px] font-black select-none`}
      >
        ?
      </span>
    );
  }
  return (
    <img
      src={equipe.logo_url}
      alt=""
      className={`${taille} shrink-0 object-contain`}
      onError={() => setEnErreur(true)}
    />
  );
}

// ============================================================================
// 🎫 BADGE DE STATUT
// ============================================================================
function StatutChip({ statut }) {
  if (statut === 'IN_PLAY') {
    return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[11px] font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
        En direct
      </span>
    );
  }
  const styles = {
    FINISHED: 'bg-slate-100 text-slate-500',
    SCHEDULED: 'bg-blue-50 text-blue-600',
    POSTPONED: 'bg-amber-50 text-amber-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${styles[statut] || styles.SCHEDULED}`}>
      {traduireStatut(statut)}
    </span>
  );
}

// ============================================================================
// 🎴 CARTE DE MATCH
// ============================================================================
function LigneEquipe({ equipe, score, gagnant, statut }) {
  const inconnue = !equipe || equipe.name === 'À déterminer';
  const fini = statut === 'FINISHED';
  const enCours = statut === 'IN_PLAY';

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2.5 min-w-0">
        <TeamLogo equipe={equipe} />
        <span
          className={`truncate text-sm ${
            inconnue
              ? 'italic text-slate-400 font-medium'
              : gagnant
                ? 'font-extrabold text-slate-900'
                : fini
                  ? 'font-medium text-slate-400'
                  : 'font-semibold text-slate-700'
          }`}
        >
          {inconnue ? 'À déterminer' : equipe.name}
        </span>
      </div>
      <span
        className={`text-base tabular-nums ${
          enCours
            ? 'font-extrabold text-red-600'
            : gagnant
              ? 'font-extrabold text-slate-900'
              : fini
                ? 'font-bold text-slate-400'
                : 'font-bold text-slate-300'
        }`}
      >
        {score ?? '–'}
      </span>
    </div>
  );
}

function CarteMatch({ m }) {
  const fini = m.status === 'FINISHED';
  const homeGagnant = fini && (m.home_winner === true || m.home_score > m.away_score);
  const awayGagnant = fini && (m.away_winner === true || m.away_score > m.home_score);
  const tab = typeof m.home_penalty === 'number' && typeof m.away_penalty === 'number';
  const date = new Date(m.start_time);

  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 shadow-sm hover:shadow-md hover:ring-slate-300 transition-all p-4 min-w-[250px]">
      <div className="flex justify-between items-center gap-2 mb-2.5 pb-2 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-400">
          {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          <span className="mx-1 text-slate-200">•</span>
          {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <StatutChip statut={m.status} />
      </div>
      <LigneEquipe equipe={m.home_team} score={m.home_score} gagnant={homeGagnant} statut={m.status} />
      <LigneEquipe equipe={m.away_team} score={m.away_score} gagnant={awayGagnant} statut={m.status} />
      {tab && (
        <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-bold text-amber-600">
          Tirs au but : {m.home_penalty} – {m.away_penalty}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 🔀 CONFRONTATIONS (1 manche, ou aller-retour comme en Champions League)
// ============================================================================
const estEquipeConnue = (eq) => eq && eq.team_id && eq.name !== 'À déterminer';

// Regroupe les matchs d'un tour : les deux manches d'une même affiche
// (mêmes équipes) sont fusionnées en une seule confrontation.
function construireTies(matchs) {
  const parCle = new Map();
  const ordre = [];
  matchs.forEach((m) => {
    if (estEquipeConnue(m.home_team) && estEquipeConnue(m.away_team)) {
      const cle = [m.home_team.team_id, m.away_team.team_id].sort().join('|');
      if (!parCle.has(cle)) {
        const groupe = [];
        parCle.set(cle, groupe);
        ordre.push(groupe);
      }
      parCle.get(cle).push(m);
    } else {
      ordre.push([m]); // équipe inconnue (tour pas encore tiré) → confrontation seule
    }
  });
  return ordre.map(finaliserTie);
}

function finaliserTie(legsBruts) {
  const legs = [...legsBruts].sort(parDate);
  const ref = legs[0];
  const teamA = ref.home_team;
  const teamB = ref.away_team;
  const idA = teamA?.team_id;
  const aScores = [];
  const bScores = [];
  let aggA = 0;
  let aggB = 0;
  let joue = false;
  let enCours = false;
  let tousFinis = true;

  legs.forEach((l) => {
    const aDom = l.home_team?.team_id === idA;
    const sA = aDom ? l.home_score : l.away_score;
    const sB = aDom ? l.away_score : l.home_score;
    aScores.push(sA);
    bScores.push(sB);
    if (l.status === 'FINISHED' && sA != null && sB != null) {
      aggA += sA;
      aggB += sB;
      joue = true;
    }
    if (l.status === 'IN_PLAY') enCours = true;
    if (l.status !== 'FINISHED') tousFinis = false;
  });

  const statut = enCours ? 'IN_PLAY' : tousFinis ? 'FINISHED' : 'SCHEDULED';

  let qualifie = null;
  if (tousFinis) {
    if (aggA > aggB) qualifie = 'A';
    else if (aggB > aggA) qualifie = 'B';
    else {
      // Égalité au cumul → tirs au but de la dernière manche
      const d = legs[legs.length - 1];
      const aDom = d.home_team?.team_id === idA;
      const pA = aDom ? d.home_penalty : d.away_penalty;
      const pB = aDom ? d.away_penalty : d.home_penalty;
      if (typeof pA === 'number' && typeof pB === 'number') qualifie = pA >= pB ? 'A' : 'B';
    }
  }

  return {
    id: ref.match_id,
    teamA,
    teamB,
    scoreA: joue ? aggA : null,
    scoreB: joue ? aggB : null,
    aScores,
    bScores,
    legs,
    deuxManches: legs.length > 1,
    statut,
    qualifie,
  };
}

// Détail des manches d'une confrontation aller-retour
function detailManches(tie) {
  const manche = (i, label) => {
    const a = tie.aScores[i];
    const b = tie.bScores[i];
    const joue = a != null && b != null && tie.legs[i]?.status === 'FINISHED';
    return `${label} ${joue ? `${a}-${b}` : '–'}`;
  };
  let texte = `${manche(0, 'Aller')} · ${manche(1, 'Retour')}`;
  const d = tie.legs[tie.legs.length - 1];
  const idA = tie.teamA?.team_id;
  const aDom = d?.home_team?.team_id === idA;
  const pA = aDom ? d?.home_penalty : d?.away_penalty;
  const pB = aDom ? d?.away_penalty : d?.home_penalty;
  if (typeof pA === 'number' && typeof pB === 'number') texte += ` · t.a.b. ${pA}-${pB}`;
  return texte;
}

// Carte d'une confrontation : 1 manche → carte de match classique ;
// aller-retour → cumul des deux manches + qualifié en gras.
function TieCard({ tie }) {
  if (!tie.deuxManches) return <CarteMatch m={tie.legs[0]} />;
  const fini = tie.statut === 'FINISHED';
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 shadow-sm hover:shadow-md hover:ring-slate-300 transition-all p-4 min-w-[240px]">
      <div className="flex justify-between items-center gap-2 mb-2.5 pb-2 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-400">Aller-retour</span>
        <StatutChip statut={tie.statut} />
      </div>
      <LigneEquipe equipe={tie.teamA} score={tie.scoreA} gagnant={fini && tie.qualifie === 'A'} statut={tie.statut} />
      <LigneEquipe equipe={tie.teamB} score={tie.scoreB} gagnant={fini && tie.qualifie === 'B'} statut={tie.statut} />
      <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
        {detailManches(tie)}
      </div>
    </div>
  );
}

// ============================================================================
// 🏆 TABLEAU DE CLASSEMENT (groupe compact ou ligue complète)
// ============================================================================
function genererClassement(matchsDuGroupe) {
  if (!matchsDuGroupe) return [];
  const stats = {};
  matchsDuGroupe.forEach((m) => {
    if (!m.home_team || !m.away_team) return;
    for (const t of [m.home_team, m.away_team]) {
      if (!stats[t.team_id]) {
        stats[t.team_id] = { id: t.team_id, equipe: t, pts: 0, j: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0 };
      }
    }
    if (m.status === 'FINISHED' && m.home_score != null && m.away_score != null) {
      const dom = stats[m.home_team.team_id];
      const ext = stats[m.away_team.team_id];
      dom.j += 1; ext.j += 1;
      dom.bp += m.home_score; dom.bc += m.away_score;
      ext.bp += m.away_score; ext.bc += m.home_score;
      if (m.home_score > m.away_score) { dom.pts += 3; dom.v += 1; ext.d += 1; }
      else if (m.home_score < m.away_score) { ext.pts += 3; ext.v += 1; dom.d += 1; }
      else { dom.pts += 1; dom.n += 1; ext.pts += 1; ext.n += 1; }
    }
  });
  return Object.values(stats)
    .map((t) => ({ ...t, diff: t.bp - t.bc }))
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.bp - a.bp;
    });
}

function Classement({ titre, lignes, compact = false, placesQualif = 0 }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-900 px-5 py-3.5 font-bold text-white text-sm">{titre}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-100">
            <tr>
              <th className="px-4 py-2.5 font-bold">Équipe</th>
              <th className="px-2 py-2.5 text-center font-bold">J</th>
              {!compact && (
                <>
                  <th className="px-2 py-2.5 text-center font-bold hidden sm:table-cell">G</th>
                  <th className="px-2 py-2.5 text-center font-bold hidden sm:table-cell">N</th>
                  <th className="px-2 py-2.5 text-center font-bold hidden sm:table-cell">P</th>
                </>
              )}
              <th className="px-2 py-2.5 text-center font-bold">+/-</th>
              <th className="px-4 py-2.5 text-center font-bold text-emerald-600">Pts</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((rang, index) => (
              <tr key={rang.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-5 h-5 rounded-md text-[11px] font-extrabold flex items-center justify-center shrink-0 ${
                        placesQualif > 0 && index < placesQualif ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <TeamLogo equipe={rang.equipe} taille="w-5 h-5" />
                    <span className="font-semibold text-slate-800 truncate max-w-[96px] sm:max-w-[160px]">{rang.equipe.name}</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center text-slate-400 tabular-nums">{rang.j}</td>
                {!compact && (
                  <>
                    <td className="px-2 py-2.5 text-center text-slate-400 tabular-nums hidden sm:table-cell">{rang.v}</td>
                    <td className="px-2 py-2.5 text-center text-slate-400 tabular-nums hidden sm:table-cell">{rang.n}</td>
                    <td className="px-2 py-2.5 text-center text-slate-400 tabular-nums hidden sm:table-cell">{rang.d}</td>
                  </>
                )}
                <td className="px-2 py-2.5 text-center text-slate-400 tabular-nums">{rang.diff > 0 ? `+${rang.diff}` : rang.diff}</td>
                <td className="px-4 py-2.5 text-center font-extrabold text-slate-900 tabular-nums">{rang.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 📅 COLONNES DE JOURNÉES (championnat / phase de ligue)
// ============================================================================
function ColonnesJournees({ journees, ordre }) {
  return (
    <div className="bg-white p-6 rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-x-auto">
      <div className="flex gap-8 min-w-max">
        {ordre.map((phaseName) => (
          <div key={phaseName} className="flex flex-col min-w-[260px]">
            <h3 className="text-center text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 border-b-2 border-slate-100 pb-2">
              {phaseName}
            </h3>
            <div className="flex flex-col gap-4">
              {journees[phaseName].map((m) => (
                <CarteMatch key={m.match_id} m={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 📄 PAGE DÉTAIL D'UNE COMPÉTITION
// ============================================================================
function CompetitionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ligue, setLigue] = useState(null);
  const [saisons, setSaisons] = useState([]);
  const [saisonActive, setSaisonActive] = useState('');
  const [matchs, setMatchs] = useState([]);
  const [chargement, setChargement] = useState(true);

  const [vueActive, setVueActive] = useState('classement'); // 'classement' | 'finale'
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
        console.error('Erreur backend:', err);
        setChargement(false);
      });
  }, [id]);

  // ==========================================================================
  // 🧠 RÉPARTITION DES MATCHS : groupes / journées / phase finale
  // ==========================================================================
  const { groupes, journees, finale, listeGroupes } = useMemo(() => {
    const matchsDeLaSaison = saisonActive ? matchs.filter((m) => m.season_id === saisonActive) : matchs;

    const grp = {};
    const jrn = {};
    const fin = {};
    const matchsGroupesBruts = [];

    // 1. Tri par nature de phase
    matchsDeLaSaison.forEach((m) => {
      const phaseBrute = m.phase || '';
      const phaseTrad = traduirePhase(phaseBrute);
      if (estPhaseFinale(phaseTrad)) {
        if (!fin[phaseTrad]) fin[phaseTrad] = [];
        fin[phaseTrad].push(m);
      } else if (phaseBrute.toLowerCase().includes('group')) {
        matchsGroupesBruts.push(m);
      } else {
        const cle = phaseTrad || 'Journée 1';
        if (!jrn[cle]) jrn[cle] = [];
        jrn[cle].push(m);
      }
    });

    // 2. Reconstruction des groupes lettrés (graphe des rencontres)
    const matriceRencontres = {};
    matchsGroupesBruts.forEach((m) => {
      const h = m.home_team?.team_id;
      const a = m.away_team?.team_id;
      if (!h || !a) return;
      if (!matriceRencontres[h]) matriceRencontres[h] = new Set();
      if (!matriceRencontres[a]) matriceRencontres[a] = new Set();
      matriceRencontres[h].add(a);
      matriceRencontres[a].add(h);
    });

    const equipesVisitees = new Set();
    const equipeVersGroupe = {};
    let indexLettre = 0;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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

    matchsGroupesBruts.forEach((m) => {
      const phaseStr = m.phase || '';
      let vraiGroupe = phaseStr.includes(' - ')
        ? phaseStr.split(' - ')[0].replace('Group', 'Groupe')
        : equipeVersGroupe[m.home_team?.team_id];
      if (!vraiGroupe) vraiGroupe = 'Phase de Groupes';
      if (!grp[vraiGroupe]) grp[vraiGroupe] = [];
      grp[vraiGroupe].push(m);
    });

    // 3. Tris
    Object.keys(grp).forEach((g) => grp[g].sort(parDate));
    Object.keys(fin).forEach((p) => fin[p].sort(parDate));
    const journeesOrdonnees = Object.keys(jrn)
      .sort(comparerJournees)
      .reduce((obj, k) => ((obj[k] = jrn[k].sort(parDate)), obj), {});

    return {
      groupes: grp,
      journees: journeesOrdonnees,
      finale: fin,
      listeGroupes: Object.keys(grp).sort(),
    };
  }, [matchs, saisonActive]);

  // ==========================================================================
  // Valeurs dérivées
  // ==========================================================================
  const aGroupes = listeGroupes.length > 0;
  const ordreJournees = Object.keys(journees);
  const aJournees = ordreJournees.length > 0;
  const aClassement = aGroupes || aJournees;

  const phasesTournoi = useMemo(
    () =>
      Object.keys(finale)
        .filter((p) => p !== 'Troisième place')
        .sort((a, b) => ordrePhases.indexOf(a) - ordrePhases.indexOf(b)),
    [finale]
  );
  const troisiemePlace = finale['Troisième place'];
  const aFinale = phasesTournoi.length > 0;

  // Classement de la ligue (CL phase de ligue, championnats) = toutes les journées
  const classementLigue = useMemo(
    () => genererClassement(Object.values(journees).flat()),
    [journees]
  );
  const classementGroupe = genererClassement(groupes[groupeActif]);

  // Onglet par défaut selon ce qui existe
  useEffect(() => {
    if (!chargement) setVueActive(aFinale && !aClassement ? 'finale' : 'classement');
  }, [chargement, saisonActive, aClassement, aFinale]);

  useEffect(() => {
    if (listeGroupes.length > 0) setGroupeActif(listeGroupes[0]);
  }, [listeGroupes, saisonActive]);

  // Regroupe chaque tour en confrontations (aller-retour fusionnés) puis
  // réordonne pour aligner chaque paire face à sa confrontation suivante.
  const roundsTies = useMemo(() => {
    const equipesTie = (t) => [t.teamA, t.teamB].filter(estEquipeConnue);
    const rounds = phasesTournoi.map((p) => construireTies(finale[p]));

    for (let k = rounds.length - 1; k > 0; k--) {
      const courant = rounds[k - 1];
      const ordonne = [];
      const utilises = new Set();

      for (const tieSuivant of rounds[k]) {
        for (const eq of equipesTie(tieSuivant)) {
          const idx = courant.findIndex(
            (t, i) => !utilises.has(i) && equipesTie(t).some((e) => e.team_id === eq.team_id)
          );
          if (idx >= 0) {
            ordonne.push(courant[idx]);
            utilises.add(idx);
          }
        }
      }
      courant.forEach((t, i) => {
        if (!utilises.has(i)) ordonne.push(t);
      });
      rounds[k - 1] = ordonne;
    }
    return rounds;
  }, [finale, phasesTournoi]);

  const libelleClassement = aGroupes ? 'Phase de groupes' : 'Classement';

  // ==========================================================================
  // 🎨 RENDU
  // ==========================================================================
  return (
    <div className="min-h-screen bg-slate-100">
      {/* ===== Bandeau d'en-tête ===== */}
      <header className="bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button
            onClick={() => navigate('/')}
            className="mb-5 text-sm font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-2"
          >
            ← Toutes les compétitions
          </button>

          {ligue && !chargement && (
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-white rounded-2xl p-2 flex items-center justify-center shadow-lg">
                  <img src={ligue.logo_url} alt={ligue.name} className="max-w-full max-h-full object-contain" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{ligue.name}</h1>
              </div>

              {saisons.length > 0 && (
                <select
                  value={saisonActive}
                  onChange={(e) => setSaisonActive(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-sm font-bold rounded-xl
                             px-4 py-2.5 cursor-pointer focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {saisons.map((s) => (
                    <option key={s.season_id} value={s.season_id}>
                      Édition {s.year_label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {chargement ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin h-10 w-10 border-b-2 border-emerald-500 rounded-full"></div>
          </div>
        ) : matchs.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl ring-1 ring-slate-200 text-center">
            Aucun match programmé pour l'instant.
          </p>
        ) : (
          <div className="space-y-8">
            {/* ===== Onglets (si classement ET phase finale existent) ===== */}
            {aClassement && aFinale && (
              <div className="inline-flex bg-white rounded-full p-1 ring-1 ring-slate-200 shadow-sm">
                {[
                  ['classement', libelleClassement],
                  ['finale', 'Phase finale'],
                ].map(([cle, label]) => (
                  <button
                    key={cle}
                    onClick={() => setVueActive(cle)}
                    className={`px-5 py-2 text-sm font-bold rounded-full transition-all ${
                      vueActive === cle ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* ===== Vue CLASSEMENT ===== */}
            {vueActive === 'classement' && aClassement && (
              aGroupes ? (
                /* --- Groupes lettrés (Coupe du Monde, Euro) --- */
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="w-full lg:w-1/3 flex flex-col gap-5">
                    {listeGroupes.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {listeGroupes.map((groupe) => (
                          <button
                            key={groupe}
                            onClick={() => setGroupeActif(groupe)}
                            className={`w-9 h-9 text-sm font-extrabold rounded-xl transition-all ${
                              groupeActif === groupe
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-white ring-1 ring-slate-200 text-slate-500 hover:ring-slate-400'
                            }`}
                          >
                            {groupe.replace('Groupe ', '')}
                          </button>
                        ))}
                      </div>
                    )}
                    <Classement
                      titre={<>Classement <span className="text-emerald-400">{groupeActif}</span></>}
                      lignes={classementGroupe}
                      compact
                      placesQualif={2}
                    />
                  </div>

                  <div className="w-full lg:w-2/3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupes[groupeActif]?.map((m) => (
                        <CarteMatch key={m.match_id} m={m} />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* --- Ligue unique (Champions League, championnats) --- */
                <div className="space-y-8">
                  <Classement titre="Classement" lignes={classementLigue} />
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">Journées</h2>
                    <ColonnesJournees journees={journees} ordre={ordreJournees} />
                  </section>
                </div>
              )
            )}

            {/* ===== Vue PHASE FINALE ===== */}
            {vueActive === 'finale' && aFinale && (
              <div className="space-y-10">
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">Tableau final</h2>

                  {/* Ordinateur : arbre connecté avec connecteurs */}
                  <div className="hidden lg:block bg-white p-8 rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-x-auto">
                    <div className="bracket min-w-max">
                      {phasesTournoi.map((phaseName, indexPhase) => (
                        <div
                          key={phaseName}
                          className={`bracket-round w-[280px] ${indexPhase === phasesTournoi.length - 1 ? 'bracket-last' : ''}`}
                        >
                          <h3 className="text-center text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 border-b-2 border-slate-100 pb-2">
                            {phaseName}
                          </h3>
                          <div className="bracket-items">
                            {roundsTies[indexPhase].map((tie) => (
                              <div key={tie.id} className="bracket-item">
                                <TieCard tie={tie} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Téléphone : tours empilés verticalement (plus lisible) */}
                  <div className="lg:hidden space-y-8">
                    {phasesTournoi.map((phaseName, indexPhase) => (
                      <div key={phaseName}>
                        <h3 className="text-center text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 border-b-2 border-slate-100 pb-2">
                          {phaseName}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {roundsTies[indexPhase].map((tie) => (
                            <TieCard key={tie.id} tie={tie} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {troisiemePlace && (
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">Troisième place</h2>
                    <div className="max-w-sm">
                      {troisiemePlace.map((m) => (
                        <CarteMatch key={m.match_id} m={m} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default CompetitionDetails;
