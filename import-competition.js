import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 🎯 TA LISTE BLANCHE : Ajoute ou retire les IDs des tournois qui t'intéressent ici
const competitionsCibles = [1, 2, 3, 4, 39, 61, 66, 78, 140];

// ⏱️ Fonction utilitaire pour mettre le script en pause (en millisecondes)
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function importerCatalogue() {
  console.log("⏳ Début du processus d'importation multiple...");

  try {
    // 1. On vérifie que le sport Football existe
    const football = await prisma.sport.findFirst({ where: { name: 'Football' } });
    if (!football) {
      console.log("❌ Le sport 'Football' n'existe pas dans la base !");
      return;
    }

    // 2. On boucle sur chaque ID de ta liste
    for (const api_id of competitionsCibles) {
      console.log(`\n🌍 Recherche de la compétition ID : ${api_id}...`);
      
      const reponseAPI = await axios.get(`https://v3.football.api-sports.io/leagues?id=${api_id}`, {
        headers: { 'x-apisports-key': process.env.API_SPORTS_KEY }
      });

      const donneesAPI = reponseAPI.data.response[0];
      if (!donneesAPI) {
        console.log(`❌ Compétition ${api_id} introuvable sur l'API.`);
        continue; // S'il y a une erreur, on passe directement au tournoi suivant
      }

      const nomCompetition = donneesAPI.league.name;
      const logoCompetition = donneesAPI.league.logo;
      
      // 3. On vérifie si elle existe déjà dans ta base Neon
      const competitionExistante = await prisma.competition.findFirst({
        where: { name: nomCompetition }
      });

      if (competitionExistante) {
        console.log(`   ✅ "${nomCompetition}" est DÉJÀ dans ta base. On l'ignore.`);
      } else {
        // 4. On l'insère !
        await prisma.competition.create({
          data: {
            name: nomCompetition,
            logo_url: logoCompetition,
            sport_id: football.sport_id
          }
        });
        console.log(`   🎉 SUCCÈS ! "${nomCompetition}" a été ajoutée à ton catalogue.`);
      }

      // ⏱️ On attend 1,5 seconde avant de demander le tournoi suivant pour ne pas froisser l'API
      await pause(1500); 
    }

    console.log("\n🏁 Importation du catalogue terminée avec succès !");

  } catch (erreur) {
    console.error("❌ Une erreur est survenue :", erreur.message);
  } finally {
    await prisma.$disconnect();
  }
}

importerCatalogue();