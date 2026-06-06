import cron from 'node-cron';

console.log("🤖 Initialisation du cerveau automatique...");

// ---------------------------------------------------------
// LA VRAIE ROUTINE (04h00 du matin)
// Le format CRON : Minute | Heure | Jour du mois | Mois | Jour de la semaine
// '0 4 * * *' = À la minute 0, à 04h00, tous les jours de tous les mois.
// ---------------------------------------------------------
cron.schedule('0 4 * * *', () => {
  console.log("⏰ [04h00] C'est l'heure ! Lancement de la mise à jour de la base de données...");
  
  // Plus tard, c'est ici que nous collerons le contenu de ton fichier import-competition.js
  // pour qu'il interroge l'API et remplisse Neon tout seul pendant que tu dors.
});


// ---------------------------------------------------------
// LE MODE TEST (Toutes les minutes)
// ' * * * * * ' = À chaque minute
// ---------------------------------------------------------
cron.schedule('* * * * *', () => {
  // On récupère l'heure exacte de ton ordinateur
  const heureActuelle = new Date().toLocaleTimeString('fr-FR');
  
  console.log(`⏱️ [${heureActuelle}] Le serveur est éveillé et surveille l'horloge...`);
});

console.log("✅ Planificateur activé ! Il tourne désormais en arrière-plan.");