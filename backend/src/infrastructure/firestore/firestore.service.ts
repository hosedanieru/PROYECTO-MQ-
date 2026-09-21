/**
 * CONEXIÓN A FIRESTORE
 * ====================
 *
 * Se usa el SDK de ADMINISTRADOR (`firebase-admin`) desde el backend:
 * el navegador nunca habla con Firestore. Así las reglas de negocio,
 * la auditoría y el consecutivo siguen garantizados por el servidor, y
 * `firestore.rules` puede negar todo acceso directo.
 *
 * Credenciales (cuenta de servicio; Consola → Configuración del
 * proyecto → Cuentas de servicio → Generar nueva clave privada):
 *
 *   FIREBASE_PROJECT_ID     "mi-proyecto"
 *   FIREBASE_CLIENT_EMAIL   "firebase-adminsdk-xxxxx@mi-proyecto.iam.gserviceaccount.com"
 *   FIREBASE_PRIVATE_KEY    "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *
 * En desarrollo con emulador basta FIRESTORE_EMULATOR_HOST=localhost:8080
 * y FIREBASE_PROJECT_ID; el SDK lo detecta solo.
 */

import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

@Injectable()
export class FirestoreService implements OnModuleDestroy {
  private readonly logger = new Logger(FirestoreService.name);
  private readonly app: App;
  readonly db: Firestore;

  constructor() {
    this.app = getApps()[0] ?? initializeApp(leerCredenciales());
    this.db = getFirestore(this.app);
    // Un `undefined` en un campo es un error en Firestore; con esto se omite.
    this.db.settings({ ignoreUndefinedProperties: true });
    this.logger.log(
      process.env.FIRESTORE_EMULATOR_HOST
        ? `Firestore: emulador en ${process.env.FIRESTORE_EMULATOR_HOST}`
        : `Firestore: proyecto ${process.env.FIREBASE_PROJECT_ID}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.db.terminate();
  }
}

function leerCredenciales() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('Falta FIREBASE_PROJECT_ID (ver .env.example).');
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return { projectId };
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // La clave viene con "\n" literales al pegarla en un .env; se restauran.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    throw new Error(
      'Faltan FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY (cuenta de servicio de Firebase).',
    );
  }
  return { projectId, credential: cert({ projectId, clientEmail, privateKey }) };
}
