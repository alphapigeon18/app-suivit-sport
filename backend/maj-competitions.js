import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const competitionsCibles = [1, 2, 3, 4, 39, 61, 66, 78, 140];

async function verifierNouvellesEditions() {
    console.log("🔍 Veille active : recherche de nouvelles éditions...");
    
    for (const compId of competitionsCibles) {
        try {
            const rep = await axios.get(`https://v3.football.api-sports.io/leagues`, {
                headers: { 'x-apisports-key': process.env.API_SPORTS_KEY },
                params: { id: compId }
            });

            const leagueData = rep.data.response[0];
            if (!leagueData) continue;

            // On regarde toutes les saisons disponibles
            for (const saisonInfo of leagueData.seasons) {
                const annee = saisonInfo.year.toString();
                
                // Vérifier si cette saison existe en base
                let saison = await prisma.season.findFirst({ 
                    where: { competition_id: compId.toString(), year_label: annee } 
                });

                if (!saison) {
                    console.log(`✨ Nouvelle édition détectée : ${leagueData.league.name} ${annee}`);
                    await prisma.season.create({
                        data: {
                            competition_id: compId.toString(),
                            year_label: annee
                            // Tu peux ajouter ici une colonne 'description' si tu veux stocker le texte de résumé
                        }
                    });
                }
            }
        } catch (e) {
            console.error(`Erreur sur la ligue ${compId}:`, e.message);
        }
    }
    await prisma.$disconnect();
}

verifierNouvellesEditions();