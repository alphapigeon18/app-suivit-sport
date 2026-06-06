import axios from 'axios';

async function testerAPI() {
  console.log("⏳ Appel aux serveurs d'API-Football...");

  try {
    // On fait une requête "GET" vers l'URL de l'API
    const reponse = await axios.get('https://v3.football.api-sports.io/teams?id=85', {
      // On donne notre badge d'accès (la clé secrète)
      headers: {
        'x-rapidapi-key': process.env.API_SPORTS_KEY,
        'x-apisports-key': process.env.API_SPORTS_KEY, // Parfois l'un ou l'autre est demandé selon le point d'entrée
      }
    });

    // L'API nous renvoie beaucoup de choses. On cible la première réponse :
    const donnees = reponse.data.response[0];

    if (!donnees) {
      console.log("❌ Aucune donnée trouvée. Vérifie ta clé API !");
      return;
    }

    const equipe = donnees.team;
    const stade = donnees.venue;

    console.log("✅ Connexion réussie ! Voici les données brutes reçues :");
    console.log(`⚽ Équipe : ${equipe.name} (${equipe.country})`);
    console.log(`🏟️  Stade : ${stade.name} (Capacité : ${stade.capacity} places)`);
    console.log(`🖼️  Lien du logo : ${equipe.logo}`); // La fameuse URL dont on parlait tout à l'heure !

  } catch (erreur) {
    console.error("❌ Erreur lors de l'appel :", erreur.message);
  }
}

testerAPI();