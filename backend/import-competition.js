import prisma from './lib/prisma.js';
import { appelApiSports, competitionsCibles, estLanceEnLigneDeCommande, obtenirSportFootball, pause } from './lib/football.js';

// Importe le catalogue des compétitions ciblées dans la base.
// Rattrape aussi les compétitions créées avant l'ajout de la colonne api_id
// (retrouvées par nom, puis mises à jour avec leur ID API).
export async function importerCatalogue() {
    console.log("⏳ Début de l'importation du catalogue...");
    const football = await obtenirSportFootball();

    for (const apiId of competitionsCibles) {
        try {
            const [donneesLigue] = await appelApiSports('leagues', { id: apiId });
            if (!donneesLigue) {
                console.log(`❌ Compétition ${apiId} introuvable sur l'API.`);
                continue;
            }

            const { name, logo } = donneesLigue.league;

            const existante = await prisma.competition.findFirst({
                where: { OR: [{ api_id: apiId }, { name }] },
            });

            if (!existante) {
                await prisma.competition.create({
                    data: { api_id: apiId, name, logo_url: logo, sport_id: football.sport_id },
                });
                console.log(`🎉 "${name}" ajoutée au catalogue.`);
            } else if (existante.api_id !== apiId) {
                await prisma.competition.update({
                    where: { competition_id: existante.competition_id },
                    data: { api_id: apiId, logo_url: logo },
                });
                console.log(`🔗 "${name}" reliée à son ID API (${apiId}).`);
            } else {
                console.log(`✅ "${name}" déjà dans la base.`);
            }

            await pause(6500); // Limite du plan gratuit : 10 appels/minute
        } catch (erreur) {
            console.error(`❌ Erreur sur la compétition ${apiId}:`, erreur.message);
        }
    }
    console.log('🏁 Importation du catalogue terminée.');
}

if (estLanceEnLigneDeCommande(import.meta.url)) {
    importerCatalogue().finally(() => prisma.$disconnect());
}
