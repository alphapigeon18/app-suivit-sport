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

const comparerJournees = (a, b) => {
  const na = Number(/(\d+)/.exec(a)?.[1] ?? 1e9);
  const nb = Number(/(\d+)/.exec(b)?.[1] ?? 1e9);
  return na - nb;
};

const parDate = (a, b) => new Date(a.start_time) - new Date(b.start_time);

// ============================================================================
// 🛡️ LOGO D'ÉQUIPE
// ============================================================================
function TeamLogo({ equipe, taille = 'w-6 h-6' }) {
  const [enErreur, setEnErreur] = useState(false);
  const inconnue = !equipe || equipe.name === 'À déterminer' || !equipe.logo_url || enErreur;

  if (inconnue) {
    return (
      <span
        className={`${taille} shrink-0 rounded-full border-2 border-dashed border-white/20 bg-white/5
                    flex items-center justify-center text-slate-500 text-[10px] font-black select-none`}
      >
        ?
      </span>
    );
  }
  return <img src={equipe.logo_url} alt="" className={`${taille} shrink-0 object-contain`} onError={() => setEnErreur(true)} />;
}

// ============================================================================
// 🎫 BADGE DE STATUT
// ============================================================================
function StatutChip({ statut }) {
  if (statut === 'IN_PLAY') {
    return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold text-red-300" style={{ background: 'rgba(239,68,68,0.16)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
        En direct
      </span>
    );
  }
  const styles = {
    FINISHED: 'bg-white/10 text-slate-400',
    SCHEDULED: 'bg-white/5 text-slate-300',
    POSTPONED: 'text-amber-300',
  };
  const inline = statut === 'POSTPONED' ? { background: 'rgba(245,158,11,0.16)' } : undefined;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${styles[statut] || styles.SCHEDULED}`} style={inline}>
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
              ? 'italic text-slate-500 font-medium'
              : gagnant
                ? 'font-extrabold text-white'
                : fini
                  ? 'font-medium text-slate-500'
                  : 'font-semibold text-slate-200'
          }`}
        >
          {inconnue ? 'À déterminer' : equipe.name}
        </span>
      </div>
      <span
        className={`text-base tabular-nums ${
          enCours
            ? 'font-extrabold text-amber-400'
            : gagnant
              ? 'font-extrabold text-white'
              : fini
                ? 'font-bold text-slate-500'
                : 'font-bold text-slate-600'
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
    <div className="surface p-4 min-w-[250px]">
      <div className="flex justify-between items-center gap-2 mb-2.5 pb-2 border-b border-white/10">
        <span className="text-xs font-semibold text-slate-500">
          {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          <span className="mx-1 text-slate-700">•</span>
          {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <StatutChip statut={m.status} />
      </div>
      <LigneEquipe equipe={m.home_team} score={m.home_score} gagnant={homeGagnant} statut={m.status} />
      <LigneEquipe equipe={m.away_team} score={m.away_score} gagnant={awayGagnant} statut={m.status} />
      {tab && (
        <div className="mt-2 pt-2 border-t border-white/10 text-[11px] font-bold text-amber-400">
          Tirs au but : {m.home_penalty} – {m.away_penalty}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 🔀 CONFRONTATIONS (1 manche ou aller-retour)
// ============================================================================
const estEquipeConnue = (eq) => eq && eq.team_id && eq.name !== 'À déterminer';

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
      ordre.push([m]);
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
      const d = legs[legs.length - 1];
      const aDom = d.home_team?.team_id === idA;
      const pA = aDom ? d.home_penalty : d.away_penalty;
      const pB = aDom ? d.away_penalty : d.home_penalty;
      if (typeof pA === 'number' && typeof pB === 'number') qualifie = pA >= pB ? 'A' : 'B';
    }
  }

  return { id: ref.match_id, teamA, teamB, scoreA: joue ? aggA : null, scoreB: joue ? aggB : null, aScores, bScores, legs, deuxManches: legs.length > 1, statut, qualifie };
}

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

function TieCard({ tie }) {
  if (!tie.deuxManches) return <CarteMatch m={tie.legs[0]} />;
  const fini = tie.statut === 'FINISHED';
  return (
    <div className="surface p-4 min-w-[240px]">
      <div className="flex justify-between items-center gap-2 mb-2.5 pb-2 border-b border-white/10">
        <span className="text-xs font-semibold text-slate-500">Aller-retour</span>
        <StatutChip statut={tie.statut} />
      </div>
      <LigneEquipe equipe={tie.teamA} score={tie.scoreA} gagnant={fini && tie.qualifie === 'A'} statut={tie.statut} />
      <LigneEquipe equipe={tie.teamB} score={tie.scoreB} gagnant={fini && tie.qualifie === 'B'} statut={tie.statut} />
      <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-slate-500 font-medium">{detailManches(tie)}</div>
    </div>
  );
}

// ============================================================================
// 🏆 CLASSEMENT
// ============================================================================
function genererClassement(matchsDuGroupe) {
  if (!matchsDuGroupe) return [];
  const stats = {};
  matchsDuGroupe.forEach((m) => {
    if (!m.home_team || !m.away_team) return;
    for (const t of [m.home_team, m.away_team]) {
      if (!stats[t.team_id]) stats[t.team_id] = { id: t.team_id, equipe: t, pts: 0, j: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0 };
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
    <div className="glass overflow-hidden">
      <div className="px-5 py-3.5 font-bold text-white text-sm border-b border-white/10">{titre}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[11px] text-slate-500 uppercase tracking-wide border-b border-white/10">
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
              <th className="px-4 py-2.5 text-center font-bold text-amber-400">PTS</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((rang, index) => (
              <tr key={rang.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-5 h-5 rounded-md text-[11px] font-extrabold flex items-center justify-center shrink-0 ${
                        placesQualif > 0 && index < placesQualif ? 'text-amber-300' : 'bg-white/8 text-slate-500'
                      }`}
                      style={placesQualif > 0 && index < placesQualif ? { background: 'rgba(245,158,11,0.18)' } : undefined}
                    >
                      {index + 1}
                    </span>
                    <TeamLogo equipe={rang.equipe} taille="w-5 h-5" />
                    <span className="font-semibold text-slate-200 truncate max-w-[96px] sm:max-w-[160px]">{rang.equipe.name}</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center text-slate-500 tabular-nums">{rang.j}</td>
                {!compact && (
                  <>
                    <td className="px-2 py-2.5 text-center text-slate-500 tabular-nums hidden sm:table-cell">{rang.v}</td>
                    <td className="px-2 py-2.5 text-center text-slate-500 tabular-nums hidden sm:table-cell">{rang.n}</td>
                    <td className="px-2 py-2.5 text-center text-slate-500 tabular-nums hidden sm:table-cell">{rang.d}</td>
                  </>
                )}
                <td className="px-2 py-2.5 text-center text-slate-500 tabular-nums">{rang.diff > 0 ? `+${rang.diff}` : rang.diff}</td>
                <td className="px-4 py-2.5 text-center font-extrabold text-white tabular-nums">{rang.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColonnesJournees({ journees, ordre }) {
  return (
    <div className="glass p-6 overflow-x-auto">
      <div className="flex gap-8 min-w-max">
        {ordre.map((phaseName) => (
          <div key={phaseName} className="flex flex-col min-w-[260px]">
            <h3 className="text-center text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-4 border-b-2 border-white/10 pb-2">
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
// 📄 PAGE
// ============================================================================
function CompetitionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ligue, setLigue] = useState(null);
  const [saisons, setSaisons] = useState([]);
  const [saisonActive, setSaisonActive] = useState('');
  const [matchs, setMatchs] = useState([]);
  const [chargement, setChargement] = useState(true);

  const [vueActive, setVueActive] = useState('classement');
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

  const { groupes, journees, finale, listeGroupes } = useMemo(() => {
    const matchsDeLaSaison = saisonActive ? matchs.filter((m) => m.season_id === saisonActive) : matchs;

    const grp = {};
    const jrn = {};
    const fin = {};
    const matchsGroupesBruts = [];

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
      let vraiGroupe = phaseStr.includes(' - ') ? phaseStr.split(' - ')[0].replace('Group', 'Groupe') : equipeVersGroupe[m.home_team?.team_id];
      if (!vraiGroupe) vraiGroupe = 'Phase de Groupes';
      if (!grp[vraiGroupe]) grp[vraiGroupe] = [];
      grp[vraiGroupe].push(m);
    });

    Object.keys(grp).forEach((g) => grp[g].sort(parDate));
    Object.keys(fin).forEach((p) => fin[p].sort(parDate));
    const journeesOrdonnees = Object.keys(jrn)
      .sort(comparerJournees)
      .reduce((obj, k) => ((obj[k] = jrn[k].sort(parDate)), obj), {});

    return { groupes: grp, journees: journeesOrdonnees, finale: fin, listeGroupes: Object.keys(grp).sort() };
  }, [matchs, saisonActive]);

  const aGroupes = listeGroupes.length > 0;
  const ordreJournees = Object.keys(journees);
  const aJournees = ordreJournees.length > 0;
  const aClassement = aGroupes || aJournees;

  const phasesTournoi = useMemo(
    () => Object.keys(finale).filter((p) => p !== 'Troisième place').sort((a, b) => ordrePhases.indexOf(a) - ordrePhases.indexOf(b)),
    [finale]
  );
  const troisiemePlace = finale['Troisième place'];
  const aFinale = phasesTournoi.length > 0;

  const classementLigue = useMemo(() => genererClassement(Object.values(journees).flat()), [journees]);
  const classementGroupe = genererClassement(groupes[groupeActif]);

  useEffect(() => {
    if (!chargement) setVueActive(aFinale && !aClassement ? 'finale' : 'classement');
  }, [chargement, saisonActive, aClassement, aFinale]);

  useEffect(() => {
    if (listeGroupes.length > 0) setGroupeActif(listeGroupes[0]);
  }, [listeGroupes, saisonActive]);

  const roundsTies = useMemo(() => {
    const equipesTie = (t) => [t.teamA, t.teamB].filter(estEquipeConnue);
    const rounds = phasesTournoi.map((p) => construireTies(finale[p]));

    for (let k = rounds.length - 1; k > 0; k--) {
      const courant = rounds[k - 1];
      const ordonne = [];
      const utilises = new Set();
      for (const tieSuivant of rounds[k]) {
        for (const eq of equipesTie(tieSuivant)) {
          const idx = courant.findIndex((t, i) => !utilises.has(i) && equipesTie(t).some((e) => e.team_id === eq.team_id));
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
  const selectGlass = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' };

  return (
    <div className="min-h-dvh">
      {/* ===== Hero ===== */}
      <header className="max-w-7xl mx-auto px-6 pt-8 pb-6">
        <button
          onClick={() => navigate('/')}
          className="mb-5 text-sm font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-2"
        >
          ← Toutes les compétitions
        </button>

        {ligue && !chargement && (
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl p-2 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <img src={ligue.logo_url} alt={ligue.name} className="max-w-full max-h-full object-contain" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{ligue.name}</h1>
            </div>

            {saisons.length > 0 && (
              <select
                value={saisonActive}
                onChange={(e) => setSaisonActive(e.target.value)}
                className="text-white text-sm font-bold rounded-xl px-4 py-2.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
                style={selectGlass}
              >
                {saisons.map((s) => (
                  <option key={s.season_id} value={s.season_id} className="bg-slate-900">
                    Édition {s.year_label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-16">
        {chargement ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin h-10 w-10 border-b-2 border-amber-400 rounded-full"></div>
          </div>
        ) : matchs.length === 0 ? (
          <p className="glass text-slate-300 p-8 text-center">Aucun match programmé pour l'instant.</p>
        ) : (
          <div className="space-y-8">
            {/* Onglets */}
            {aClassement && aFinale && (
              <div className="glass-deep inline-flex rounded-full p-1">
                {[
                  ['classement', libelleClassement],
                  ['finale', 'Phase finale'],
                ].map(([cle, label]) => (
                  <button
                    key={cle}
                    onClick={() => setVueActive(cle)}
                    className={`px-5 py-2 text-sm font-bold rounded-full transition-all ${
                      vueActive === cle ? 'text-slate-900' : 'text-slate-400 hover:text-white'
                    }`}
                    style={vueActive === cle ? { background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Vue CLASSEMENT */}
            {vueActive === 'classement' &&
              aClassement &&
              (aGroupes ? (
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="w-full lg:w-1/3 flex flex-col gap-5">
                    {listeGroupes.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {listeGroupes.map((groupe) => {
                          const actif = groupeActif === groupe;
                          return (
                            <button
                              key={groupe}
                              onClick={() => setGroupeActif(groupe)}
                              className={`w-9 h-9 text-sm font-extrabold rounded-xl transition-all ${actif ? 'text-slate-900' : 'surface text-slate-400 hover:text-white'}`}
                              style={actif ? { background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' } : undefined}
                            >
                              {groupe.replace('Groupe ', '')}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <Classement titre={<>Classement <span className="text-amber-400">{groupeActif}</span></>} lignes={classementGroupe} compact placesQualif={2} />
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
                <div className="space-y-8">
                  <Classement titre="Classement" lignes={classementLigue} />
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-4">Journées</h2>
                    <ColonnesJournees journees={journees} ordre={ordreJournees} />
                  </section>
                </div>
              ))}

            {/* Vue PHASE FINALE */}
            {vueActive === 'finale' && aFinale && (
              <div className="space-y-10">
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-4">Tableau final</h2>

                  <div className="hidden lg:block glass p-8 overflow-x-auto">
                    <div className="bracket min-w-max">
                      {phasesTournoi.map((phaseName, indexPhase) => (
                        <div key={phaseName} className={`bracket-round w-[280px] ${indexPhase === phasesTournoi.length - 1 ? 'bracket-last' : ''}`}>
                          <h3 className="text-center text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-4 border-b-2 border-white/10 pb-2">{phaseName}</h3>
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

                  <div className="lg:hidden space-y-8">
                    {phasesTournoi.map((phaseName, indexPhase) => (
                      <div key={phaseName}>
                        <h3 className="text-center text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-4 border-b-2 border-white/10 pb-2">{phaseName}</h3>
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
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-4">Troisième place</h2>
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
