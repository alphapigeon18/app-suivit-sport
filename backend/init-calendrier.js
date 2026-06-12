import prisma from './lib/prisma.js';
import {
    appelApiSports,
    competitionsCibles,
    estLanceEnLigneDeCommande,
    obtenirEquipeMystere,
    obtenirSaison,
    obtenirSportFootball,
    pause,
    upsertMatch,
} from './lib/football.js';

// Importe / rafraîchit le calendrier complet de la saison courante
// de chaque compétition suivie.
export async function initialiserCalendrier() {
    console.log('🚀 Mise à jour du calendrier complet...');
    const football = await obtenirSportFootball();
    const equipeMystere = await obtenirEquipeMystere(football.sport_id);

    for (const apiLeagueId of competitionsCibles) {
        try {
            const [donneesLigue] = await appelApiSports('leagues', { id: apiLeagueId });
            await pause(6500); // Limite du plan gratuit : 10 appels/minute
            if (!donneesLigue) continue;

            const competition = await prisma.competition.findUnique({ where: { api_id: apiLeagueId } });
            if (!competition) {
                console.log(`⚠️ ${donneesLigue.league.name} absente du catalogue (lancer import-competition).`);
                continue;
            }

            const saisonActuelle = donneesLigue.seasons.find((s) => s.current === true);
            if (!saisonActuelle) continue;

            console.log(`🏆 ${donneesLigue.league.name} (Saison ${saisonActuelle.year})`);
            const saison = await obtenirSaison(competition.competition_id, saisonActuelle.year);

            const matchsAPI = await appelApiSports('fixtures', { league: apiLeagueId, season: saisonActuelle.year });

            for (const matchDonnees of matchsAPI) {
                await upsertMatch(matchDonnees, saison, football.sport_id, equipeMystere);
            }
            console.log(`✅ ${matchsAPI.length} matchs synchronisés.`);

            await pause(6500); // Limite du plan gratuit : 10 appels/minute
        } catch (erreur) {
            console.error(`❌ Erreur sur la ligue ${apiLeagueId}:`, erreur.message);
        }
    }
    console.log('🏁 Calendrier à jour !');
}

if (estLanceEnLigneDeCommande(import.meta.url)) {
    initialiserCalendrier().finally(() => prisma.$disconnect());
}
