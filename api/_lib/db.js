/* Shared MongoDB connection for Vercel serverless functions.
   The client is cached across hot-reloads inside the same function instance. */
const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function connectDB() {
  if (cachedDb) return cachedDb;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI env var is not set');
  cachedClient = new MongoClient(uri);
  await cachedClient.connect();
  cachedDb = cachedClient.db('tinyplanetcolony');
  return cachedDb;
}

module.exports = { connectDB };
