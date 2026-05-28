"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDatabase = exports.connectDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Connects to MongoDB using the MONGO_URI environment variable.
 * Throws if the URI is not set or the connection fails.
 */
async function connectDatabase() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error('MONGO_URI environment variable is not set');
    }
    await mongoose_1.default.connect(uri);
    console.log('Connected to MongoDB');
    mongoose_1.default.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
    });
    mongoose_1.default.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
    });
}
exports.connectDatabase = connectDatabase;
/**
 * Gracefully closes the MongoDB connection.
 */
async function disconnectDatabase() {
    await mongoose_1.default.disconnect();
    console.log('Disconnected from MongoDB');
}
exports.disconnectDatabase = disconnectDatabase;
//# sourceMappingURL=database.js.map