import { PrismaClient } from '@prisma/client';
import './config.js';

// Instancia única compartida por toda la app.
export const prisma = new PrismaClient();
