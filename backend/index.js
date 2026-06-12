import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import prisma from './lib/prisma.js';
import { majCalendrier } from './maj-calendrier.js';
import { majQuotidienne } from './maj-quotidienne.js';

// Initialisation
const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(cors());

// ============================================================================
// ⚙️ CYCLE DE MISE À JOUR (déclenché par le ping cron-job.org toutes les 10 min)
//
// Le serveur décide lui-même quoi faire pour respecter les quotas gratuits
// (API-Sports : 100 appels/jour) :
//   - 1 fois par jour : synchronisation complète du calendrier (football-data)
//   - sinon : rafraîchissement des scores UNIQUEMENT si des matchs sont en
//     cours ou démarrent bientôt (1 appel API-Sports)
//   - sinon : rien (le ping sert juste de keep-alive)
// ============================================================================
let jobEnCours = false;
let derniereSyncCalendrier = 0;
const INTERVALLE_CALENDRIER = 23 * 60 * 60 * 1000; // ~1 fois par jour

async function matchsEnCoursOuImminents() {
    const maintenant = Date.now();
    return prisma.match.count({
        where: {
            OR: [
                { status: 'IN_PLAY' },
                {
                    status: 'SCHEDULED',
                    start_time: {
                        gte: new Date(maintenant - 3 * 60 * 60 * 1000), // démarré il y a < 3h (statut pas encore à jour)
                        lte: new Date(maintenant + 30 * 60 * 1000),     // ou qui démarre dans < 30 min
                    },
                },
            ],
        },
    });
}

async function executerCycle() {
    if (jobEnCours) {
        console.log('⏭️ Un cycle est déjà en cours, on ignore ce déclenchement.');
        return;
    }
    jobEnCours = true;
    try {
        if (Date.now() - derniereSyncCalendrier > INTERVALLE_CALENDRIER) {
            console.log(`\n🔄 [${new Date().toISOString()}] Cycle complet quotidien...`);
            try {
                await majCalendrier();
                derniereSyncCalendrier = Date.now();
            } catch (erreur) {
                console.error('❌ Erreur sur le calendrier (football-data) :', erreur.message);
            }
            try {
                await majQuotidienne();
            } catch (erreur) {
                console.error('❌ Erreur sur la MAJ quotidienne (API-Sports) :', erreur.message);
            }
            console.log('🏁 Cycle complet terminé.');
            return;
        }

        const actifs = await matchsEnCoursOuImminents();
        if (actifs > 0) {
            console.log(`⚽ ${actifs} match(s) en cours ou imminent(s) : rafraîchissement des scores...`);
            try {
                await majQuotidienne();
            } catch (erreur) {
                console.error('❌ Erreur sur le rafraîchissement live :', erreur.message);
            }
        }
    } finally {
        jobEnCours = false;
    }
}

// ============================================================================
// 🚪 ROUTES API
// ============================================================================

app.get('/', (req, res) => {
    res.send('Serveur opérationnel !');
});

// Déclenchement du cycle de mise à jour (pingé par cron-job.org toutes les 10 min).
// Protégé par un token (variable d'environnement CRON_SECRET).
app.get('/cron-daily', (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (secret) {
        const tokenRecu = req.query.token || req.get('x-cron-token');
        if (tokenRecu !== secret) {
            return res.status(403).send('Accès refusé.');
        }
    }

    // On répond tout de suite (cron-job.org a un timeout court),
    // le cycle continue en arrière-plan.
    res.status(202).send('Cycle de mise à jour lancé.');
    executerCycle();
});

// Liste des compétitions (page d'accueil)
app.get('/competitions', async (req, res) => {
    try {
        const competitions = await prisma.competition.findMany({
            orderBy: { name: 'asc' },
        });
        res.json(competitions);
    } catch (erreur) {
        console.error('❌ /competitions :', erreur.message);
        res.status(500).json({ erreur: 'Erreur lors de la récupération.' });
    }
});

// Détail d'une compétition : infos, saisons et tous les matchs (page détail)
app.get('/competitions/:id/matchs', async (req, res) => {
    try {
        const ligue = await prisma.competition.findUnique({
            where: { competition_id: req.params.id },
        });
        if (!ligue) {
            return res.status(404).json({ erreur: 'Compétition introuvable.' });
        }

        const saisons = await prisma.season.findMany({
            where: { competition_id: ligue.competition_id },
            orderBy: { year_label: 'desc' },
        });

        const matchsBruts = await prisma.match.findMany({
            where: { season: { competition_id: ligue.competition_id } },
            include: {
                team_match_home_team_idToteam: true,
                team_match_away_team_idToteam: true,
            },
            orderBy: { start_time: 'asc' },
        });

        // On renomme les relations Prisma en home_team / away_team pour le frontend
        const matchs = matchsBruts.map(
            ({ team_match_home_team_idToteam: home_team, team_match_away_team_idToteam: away_team, ...match }) => ({
                ...match,
                home_team,
                away_team,
            })
        );

        res.json({ ligue, saisons, matchs });
    } catch (erreur) {
        console.error('❌ /competitions/:id/matchs :', erreur.message);
        res.status(500).json({ erreur: 'Erreur lors de la récupération.' });
    }
});

// ============================================================================
// 🚀 DÉMARRAGE DU SERVEUR
// ============================================================================
app.listen(port, () => {
    console.log(`🚀 Serveur backend lancé sur le port ${port}`);
    if (!process.env.CRON_SECRET) {
        console.warn('⚠️ CRON_SECRET non défini : /cron-daily est accessible sans token !');
    }
});
