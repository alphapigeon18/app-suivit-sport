import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import prisma from './lib/prisma.js';
import { majCalendrier } from './maj-calendrier.js';
import { majQuotidienne, finaliserMatchsBloques } from './maj-quotidienne.js';
import { notifierMatchsTermines, envoyerATous } from './lib/notifications.js';

// Initialisation
const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(cors());

// ============================================================================
// ⚙️ CYCLE DE MISE À JOUR (déclenché par le ping cron-job.org toutes les 10 min)
//
// Le ping ne sert qu'à garder le serveur éveillé. Le cycle décide quoi faire
// avec des contrôles en BASE (gratuits) ; il n'appelle l'API-Football QUE :
//   - 1 fois par jour (après 4h) : synchro complète du calendrier + finalisation
//   - pendant la FENÊTRE HORAIRE d'un match (du coup d'envoi à +2h40) : scores
//   - quand un match est resté bloqué après son horaire : finalisation ciblée
// Hors de ces cas, le ping ne fait qu'une lecture en base : zéro appel API.
// ============================================================================
const FENETRE_FIN_MS = 160 * 60 * 1000;   // durée max d'un match (prolongations + t.a.b.)
const HEURE_SYNC_UTC = 4;                  // synchro quotidienne après 4h (UTC)

let jobEnCours = false;
let dernierJourSync = null;

function syncQuotidienneDue() {
    const now = new Date();
    return now.getUTCHours() >= HEURE_SYNC_UTC && now.toISOString().slice(0, 10) !== dernierJourSync;
}

// Y a-t-il un match dans sa fenêtre horaire (coup d'envoi imminent ou en cours) ?
// Basé sur start_time, PAS sur le statut → insensible aux matchs bloqués.
async function fenetreMatchActive() {
    const maintenant = Date.now();
    const n = await prisma.match.count({
        where: {
            status: { in: ['SCHEDULED', 'IN_PLAY'] },
            start_time: {
                gte: new Date(maintenant - FENETRE_FIN_MS), // a commencé il y a moins de 2h40
                lte: new Date(maintenant + 5 * 60 * 1000),  // ou commence dans moins de 5 min
            },
        },
    });
    return n > 0;
}

// Un match a-t-il dépassé sa fenêtre sans être finalisé ?
async function aDesMatchsBloques() {
    const maintenant = Date.now();
    const n = await prisma.match.count({
        where: {
            status: { in: ['SCHEDULED', 'IN_PLAY'] },
            api_id: { not: null },
            start_time: {
                gte: new Date(maintenant - 3 * 24 * 60 * 60 * 1000),
                lt: new Date(maintenant - FENETRE_FIN_MS),
            },
        },
    });
    return n > 0;
}

async function executerCycle() {
    if (jobEnCours) {
        console.log('⏭️ Un cycle est déjà en cours, on ignore ce déclenchement.');
        return;
    }
    jobEnCours = true;
    try {
        if (syncQuotidienneDue()) {
            console.log(`\n🔄 [${new Date().toISOString()}] Synchro quotidienne...`);
            dernierJourSync = new Date().toISOString().slice(0, 10);
            try {
                await majCalendrier();
            } catch (erreur) {
                console.error('❌ Erreur calendrier (football-data) :', erreur.message);
            }
            try {
                await finaliserMatchsBloques();
            } catch (erreur) {
                console.error('❌ Erreur finalisation :', erreur.message);
            }
            console.log('🏁 Synchro quotidienne terminée.');
        } else if (await fenetreMatchActive()) {
            console.log('⚽ Match dans sa fenêtre horaire : rafraîchissement des scores...');
            try {
                await majQuotidienne();
            } catch (erreur) {
                console.error('❌ Erreur rafraîchissement live :', erreur.message);
            }
        } else if (await aDesMatchsBloques()) {
            try {
                await finaliserMatchsBloques();
            } catch (erreur) {
                console.error('❌ Erreur finalisation :', erreur.message);
            }
        }
        // (sinon : rien — le ping n'a fait que des lectures en base, aucun appel API)

        // On notifie les matchs qui viennent de passer à « terminé »
        try {
            await notifierMatchsTermines();
        } catch (erreur) {
            console.error('❌ Erreur notifications fin de match :', erreur.message);
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
// 🔔 NOTIFICATIONS PUSH (Web Push natif)
// ============================================================================

// Clé publique VAPID (le frontend en a besoin pour s'abonner)
app.get('/notifications/vapid-public-key', (req, res) => {
    const cle = process.env.VAPID_PUBLIC_KEY;
    if (!cle) return res.status(503).json({ erreur: 'Notifications non configurées.' });
    res.json({ publicKey: cle });
});

// Enregistre l'abonnement d'un appareil
app.post('/notifications/subscribe', async (req, res) => {
    try {
        const sub = req.body;
        if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
            return res.status(400).json({ erreur: 'Abonnement invalide.' });
        }
        await prisma.push_subscription.upsert({
            where: { endpoint: sub.endpoint },
            create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        });
        res.status(201).json({ ok: true });
    } catch (erreur) {
        console.error('❌ /notifications/subscribe :', erreur.message);
        res.status(500).json({ erreur: 'Erreur abonnement.' });
    }
});

// Supprime l'abonnement d'un appareil
app.post('/notifications/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (endpoint) await prisma.push_subscription.deleteMany({ where: { endpoint } });
        res.json({ ok: true });
    } catch (erreur) {
        console.error('❌ /notifications/unsubscribe :', erreur.message);
        res.status(500).json({ erreur: 'Erreur désabonnement.' });
    }
});

// Envoi d'une notification de test à tous les abonnés (protégé par token).
// Accessible en GET (pratique depuis un navigateur) ou POST.
async function envoyerNotificationTest(req, res) {
    const secret = process.env.CRON_SECRET;
    if (secret) {
        const token = req.query.token || req.get('x-cron-token');
        if (token !== secret) return res.status(403).send('Accès refusé.');
    }
    const base = (process.env.FRONTEND_URL || 'https://alphapigeon18.github.io/app-suivit-sport').replace(/\/$/, '');
    const resultat = await envoyerATous({
        title: '🏆 SuiviSport',
        body: 'Notification de test — tout fonctionne !',
        url: base,
        icon: `${base}/pwa-192x192.png`,
        badge: `${base}/badge-96x96.png`,
    });
    res.json(resultat);
}
app.get('/notifications/test', envoyerNotificationTest);
app.post('/notifications/test', envoyerNotificationTest);

// ============================================================================
// 🚀 DÉMARRAGE DU SERVEUR
// ============================================================================
app.listen(port, () => {
    console.log(`🚀 Serveur backend lancé sur le port ${port}`);
    if (!process.env.CRON_SECRET) {
        console.warn('⚠️ CRON_SECRET non défini : /cron-daily est accessible sans token !');
    }
});
