// En local, crée un fichier frontend/.env.development avec :
//   VITE_API_URL=http://localhost:3000
// En production (Vercel/Netlify...), définis VITE_API_URL dans les variables d'environnement.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://app-suivit-sport-production.up.railway.app';
