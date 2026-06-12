import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Client Prisma unique, partagé par le serveur et tous les scripts.
// Évite d'ouvrir une connexion Neon par script.
const prisma = new PrismaClient();

export default prisma;
