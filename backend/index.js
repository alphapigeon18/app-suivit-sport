import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import prisma from './lib/prisma.js';
import { initialiserCalendrier } from './init-calendrier.js';
import { majQuotidienne } from './maj-quotidienne.js';

// Initialisation
const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(cors());

// ============================================================================
// ⚙️ JOB QUOTIDIEN (déclenché par cron-job.org via /cron-daily)
// ============================================================================
let jobEnCours = false;

async function runDailyJobs() {
    if (jobEnCours) {
        console.log('⏭️ Un cycle est déjà en cours, on ignore ce déclenchement.');
        return;
    }
    jobEnCours = true;
    console.log(`\n🔄 [${new Date().toISOString()}] Début du cycle de mise à jour...`);

    const etapes = [
        ['Calendrier complet', initialiserCalendrier],
        ['MAJ quotidienne', majQuotidienne],
    ];

    for (const [nom, etape] of etapes) {
        try {
            await etape();
        } catch (erreur) {
            console.error(`❌ Erreur critique sur "${nom}":`, erreur.message);
        }
    }

    jobEnCours = false;
    console.log('🏁 Cycle terminé.');
}

// ============================================================================
// 🚪 ROUTES API
// ============================================================================

app.get('/', (req, res) => {
    res.send('Serveur opérationnel !');
});

// Déclenchement du job quotidien (appelé par cron-job.org).
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
    res.status(202).send('Job quotidien lancé.');
    runDailyJobs();
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
