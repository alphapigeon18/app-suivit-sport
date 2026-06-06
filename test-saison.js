import axios from 'axios';

async function trouverAnnee() {
    const reponse = await axios.get(`https://v3.football.api-sports.io/leagues?id=1`, {
        headers: { 'x-apisports-key': process.env.API_SPORTS_KEY }
    });

    const donnees = reponse.data.response[0];
    // On cherche la saison qui a le statut "current: true"
    const saisonActuelle = donnees.seasons.find(s => s.current === true);
    
    console.log(`🏆 Tournoi : ${donnees.league.name}`);
    console.log(`📅 L'année officielle à utiliser pour l'édition de cette année est : ${saisonActuelle.year}`);
}

trouverAnnee();