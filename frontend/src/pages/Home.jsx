import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import NotificationButton from '@/components/NotificationButton';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const degradeAmbre = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 60%, #ea580c 100%)';

const CLE_ORDRE = 'suivisport.ordre';
const CLE_MASQUEES = 'suivisport.masquees';
const lireListe = (cle) => {
  try {
    const v = JSON.parse(localStorage.getItem(cle));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const ecrireListe = (cle, val) => {
  try {
    localStorage.setItem(cle, JSON.stringify(val));
  } catch (e) {
    console.error('localStorage :', e);
  }
};

// Icônes
const Grip = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="3" r="1.4" /><circle cx="11" cy="3" r="1.4" />
    <circle cx="5" cy="8" r="1.4" /><circle cx="11" cy="8" r="1.4" />
    <circle cx="5" cy="13" r="1.4" /><circle cx="11" cy="13" r="1.4" />
  </svg>
);
const Oeil = ({ off }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? (
      <>
        <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a13 13 0 0 1-1.67 2.68" />
        <path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </>
    ) : (
      <>
        <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8-10-8-10-8Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

// Ligne d'édition triable (glisser-déposer + masquer)
function LigneEdition({ comp, masquee, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: comp.competition_id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined };

  return (
    <div ref={setNodeRef} style={style} className={`surface flex items-center gap-3 p-3 mb-2 ${masquee ? 'opacity-50' : ''}`}>
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 px-1 shrink-0"
        aria-label="Déplacer"
      >
        <Grip />
      </button>
      <img src={comp.logo_url} alt="" className="w-9 h-9 object-contain shrink-0" />
      <span className="flex-1 font-semibold text-slate-200 text-sm truncate">{comp.name}</span>
      <button
        onClick={onToggle}
        aria-label={masquee ? 'Afficher' : 'Masquer'}
        className={`shrink-0 p-1.5 rounded-lg transition-colors ${masquee ? 'text-slate-500 hover:text-slate-300' : 'text-amber-400 hover:bg-white/5'}`}
      >
        <Oeil off={masquee} />
      </button>
    </div>
  );
}

function Home() {
  const [competitions, setCompetitions] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [edition, setEdition] = useState(false);
  const [ordre, setOrdre] = useState(() => lireListe(CLE_ORDRE));
  const [masquees, setMasquees] = useState(() => lireListe(CLE_MASQUEES));
  const navigate = useNavigate();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  // Tri selon l'ordre choisi ; les compétitions sans ordre (ou nouvelles) à la fin
  const competitionsOrdonnees = useMemo(() => {
    const index = new Map(ordre.map((id, i) => [id, i]));
    return [...competitions].sort((a, b) => {
      const ia = index.has(a.competition_id) ? index.get(a.competition_id) : Infinity;
      const ib = index.has(b.competition_id) ? index.get(b.competition_id) : Infinity;
      if (ia !== ib) return ia - ib;
      return a.name.localeCompare(b.name);
    });
  }, [competitions, ordre]);

  const estMasquee = (id) => masquees.includes(id);
  const visibles = competitionsOrdonnees.filter((c) => !estMasquee(c.competition_id));

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const ids = competitionsOrdonnees.map((c) => c.competition_id);
    const nouvelOrdre = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id));
    setOrdre(nouvelOrdre);
    ecrireListe(CLE_ORDRE, nouvelOrdre);
  };

  const toggleMasque = (id) => {
    const next = estMasquee(id) ? masquees.filter((x) => x !== id) : [...masquees, id];
    setMasquees(next);
    ecrireListe(CLE_MASQUEES, next);
  };

  return (
    <div className="min-h-dvh">
      <header className="max-w-6xl mx-auto px-6 pt-12 sm:pt-16 pb-8">
        <div className="flex items-center gap-4 mb-4">
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: degradeAmbre, boxShadow: '0 10px 30px rgba(245,158,11,0.45)' }}>
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
            <div className="flex items-center justify-between mb-5 gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400/70">Compétitions suivies</h2>
              <button
                onClick={() => setEdition((e) => !e)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                  edition ? 'btn-accent' : 'text-slate-300 hover:text-white'
                }`}
                style={edition ? undefined : { border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {edition ? 'Terminé' : 'Personnaliser'}
              </button>
            </div>

            {edition ? (
              <>
                <p className="text-xs text-slate-500 mb-4">
                  Glisse <span className="text-slate-300">⠿</span> pour réordonner, touche l'œil pour masquer une compétition.
                </p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={competitionsOrdonnees.map((c) => c.competition_id)} strategy={verticalListSortingStrategy}>
                    {competitionsOrdonnees.map((comp) => (
                      <LigneEdition key={comp.competition_id} comp={comp} masquee={estMasquee(comp.competition_id)} onToggle={() => toggleMasque(comp.competition_id)} />
                    ))}
                  </SortableContext>
                </DndContext>
              </>
            ) : visibles.length === 0 ? (
              <p className="glass text-slate-300 p-6 text-center text-sm">
                Toutes les compétitions sont masquées. Appuie sur « Personnaliser » pour en réafficher.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {visibles.map((comp) => (
                  <button
                    key={comp.competition_id}
                    onClick={() => navigate(`/competition/${comp.competition_id}`)}
                    className="group glass hoverable p-5 flex items-center gap-5 text-left cursor-pointer"
                  >
                    <div className="w-16 h-16 shrink-0 rounded-xl p-2.5 flex justify-center items-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <img src={comp.logo_url} alt={`Logo ${comp.name}`} className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors truncate">{comp.name}</h3>
                      <span className="inline-block mt-1.5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-full" style={{ background: 'rgba(245,158,11,0.14)', color: '#fcd34d' }}>
                        Football
                      </span>
                    </div>
                    <span className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all text-xl font-bold">→</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Home;
