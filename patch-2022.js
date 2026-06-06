import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function patchWorldCup2022() {
    console.log("⚽ Téléchargement exclusif des penaltys de la Coupe du Monde 2022...");
    
    try {
        const rep = await axios.get(`https://v3.football.api-sports.io/fixtures`, {
            headers: { 'x-apisports-key': process.env.API_SPORTS_KEY },
            params: { league: 1, season: 2022 } // 1 = ID de la World Cup
        });

        const matchsAPI = rep.data.response || [];
        let maj = 0;

        for (const matchDonnees of matchsAPI) {
            const api_fixture_id = matchDonnees.fixture.id.toString();
            
            // On met à jour uniquement les matchs qui existent déjà dans ta base
            await prisma.match.updateMany({
                where: { api_id: api_fixture_id },
                data: {
                    home_penalty: matchDonnees.score?.penalty?.home ?? null,
                    away_penalty: matchDonnees.score?.penalty?.away ?? null,
                    home_winner: matchDonnees.teams.home.winner ?? null,
                    away_winner: matchDonnees.teams.away.winner ?? null,
                }
            });
            maj++;
        }
        console.log(`✅ SUPER : ${maj} matchs de 2022 ont été enrichis avec les vainqueurs et penaltys !`);
    } catch (err) {
        console.error("❌ Erreur :", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

patchWorldCup2022();