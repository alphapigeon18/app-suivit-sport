import webpush from 'web-push';
import prisma from './prisma.js';

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://alphapigeon18.github.io/app-suivit-sport').replace(/\/$/, '');

let configure = false;
function configurerWebPush() {
    if (configure) return true;
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
    webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:contact@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configure = true;
    return true;
}

// Envoie une notification à tous les appareils abonnés.
// Supprime au passage les abonnements expirés (404/410).
export async function envoyerATous(payload) {
    if (!configurerWebPush()) {
        console.warn('⚠️ Clés VAPID absentes : notifications désactivées.');
        return { envoyees: 0, supprimees: 0 };
    }

    const abonnements = await prisma.push_subscription.findMany();
    const corps = JSON.stringify(payload);
    let envoyees = 0;
    const endpointsMorts = [];

    await Promise.all(
        abonnements.map(async (ab) => {
            const subscription = { endpoint: ab.endpoint, keys: { p256dh: ab.p256dh, auth: ab.auth } };
            try {
                await webpush.sendNotification(subscription, corps);
                envoyees++;
            } catch (erreur) {
                if (erreur.statusCode === 404 || erreur.statusCode === 410) {
                    endpointsMorts.push(ab.endpoint);
                } else {
                    console.error('❌ Envoi push échoué :', erreur.statusCode || erreur.message);
                }
            }
        })
    );

    if (endpointsMorts.length > 0) {
        await prisma.push_subscription.deleteMany({ where: { endpoint: { in: endpointsMorts } } });
    }

    return { envoyees, supprimees: endpointsMorts.length };
}

// Détecte les matchs qui viennent de se terminer (status FINISHED, jamais
// notifiés, démarrés dans les dernières 24 h) et envoie une notification.
// Marque notified_at pour ne jamais renvoyer deux fois.
export async function notifierMatchsTermines() {
    const ilYa24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const matchs = await prisma.match.findMany({
        where: {
            status: 'FINISHED',
            notified_at: null,
            start_time: { gte: ilYa24h },
            home_score: { not: null },
            away_score: { not: null },
        },
        include: {
            team_match_home_team_idToteam: true,
            team_match_away_team_idToteam: true,
            season: { include: { competition: true } },
        },
    });

    if (matchs.length === 0) return;
    console.log(`🔔 ${matchs.length} match(s) terminé(s) à notifier...`);

    for (const m of matchs) {
        const dom = m.team_match_home_team_idToteam.name;
        const ext = m.team_match_away_team_idToteam.name;
        const competition = m.season.competition;
        const score = `${m.home_score}–${m.away_score}`;
        const tab =
            typeof m.home_penalty === 'number' && typeof m.away_penalty === 'number'
                ? ` (${m.home_penalty}-${m.away_penalty} t.a.b.)`
                : '';

        const payload = {
            title: '🏆 Match terminé',
            body: `${dom} ${score} ${ext}${tab}`,
            tag: `match-${m.match_id}`,
            url: `${FRONTEND_URL}/competition/${competition.competition_id}`,
            icon: `${FRONTEND_URL}/pwa-192x192.png`,
            badge: `${FRONTEND_URL}/pwa-192x192.png`,
            sousTitre: competition.name,
        };

        try {
            const res = await envoyerATous(payload);
            await prisma.match.update({ where: { match_id: m.match_id }, data: { notified_at: new Date() } });
            console.log(`   ✅ ${dom} ${score} ${ext} → ${res.envoyees} appareil(s)`);
        } catch (erreur) {
            console.error(`   ❌ Échec notification pour ${dom}-${ext} :`, erreur.message);
        }
    }
}
