/**
 * Connects to MongoDB using the MONGO_URI environment variable.
 * Throws if the URI is not set or the connection fails.
 */
export declare function connectDatabase(): Promise<void>;
/**
 * Gracefully closes the MongoDB connection.
 */
export declare function disconnectDatabase(): Promise<void>;
//# sourceMappingURL=database.d.ts.map