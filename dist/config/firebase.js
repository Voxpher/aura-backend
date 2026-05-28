"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.admin = exports.initFirebase = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
exports.admin = firebase_admin_1.default;
/**
 * Initialises the Firebase Admin SDK using environment variables.
 * Safe to call multiple times — skips initialisation if already done.
 */
function initFirebase() {
    if (firebase_admin_1.default.apps.length > 0) {
        // Already initialised
        return;
    }
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!projectId || !clientEmail || !privateKey) {
        console.warn('[Firebase] Environment variables not fully set — push notifications will be unavailable until configured.');
        return;
    }
    firebase_admin_1.default.initializeApp({
        credential: firebase_admin_1.default.credential.cert({
            projectId,
            clientEmail,
            // Replace escaped newlines that may come from .env files
            privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
    });
    console.log('Firebase Admin SDK initialised');
}
exports.initFirebase = initFirebase;
//# sourceMappingURL=firebase.js.map