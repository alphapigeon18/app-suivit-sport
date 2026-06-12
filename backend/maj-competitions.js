import prisma from './lib/prisma.js';
import { appelApiSports, competitionsCibles, estLanceEnLigneDeCommande, obtenirSaison, pause } from './lib/football.js';

// Veille : détecte les nouvelles éditions (saisons) des compétitions suivies
// et crée la ligne season correspondante si elle n'existe pas encore.
export async function verifierNouvellesEditions() {
    console.log('🔍 Veille active : recherche de nouvelles éditions...');

    for (const apiId of competitionsCibles) {
        try {
            const [donneesLigue] = await appelApiSports('leagues', { id: apiId });
            if (!donneesLigue) continue;

            const competition = await prisma.competition.findUnique({ where: { api_id: apiId } });
            if (!competition) {
                console.log(`⚠️ Compétition API ${apiId} absente du catalogue (lancer import-competition).`);
                continue;
            }

            const saisonCourante = donneesLigue.seasons.find((s) => s.current === true);
            if (!saisonCourante) continue;

            const existante = await prisma.season.findFirst({
                where: { competition_id: competition.competition_id, year_label: saisonCourante.year.toString() },
            });

            if (!existante) {
                console.log(`✨ Nouvelle édition détectée : ${donneesLigue.league.name} ${saisonCourante.year}`);
                await obtenirSaison(competition.competition_id, saisonCourante.year);
            }

            await pause(6500); // Limite du plan gratuit : 10 appels/minute
        } catch (erreur) {
            console.error(`❌ Erreur sur la ligue ${apiId}:`, erreur.message);
        }
    }
    console.log('🏁 Veille terminée.');
}

if (estLanceEnLigneDeCommande(import.meta.url)) {
    verifierNouvellesEditions().finally(() => prisma.$disconnect());
}
