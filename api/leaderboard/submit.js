const { connectDB } = require('../_lib/db');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'Not authenticated' });

  let payload;
  try {
    payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { completionTime, greenPct, population } = req.body || {};
  if (typeof completionTime !== 'number' || completionTime <= 0)
    return res.status(400).json({ error: 'Invalid completion time' });

  try {
    const db = await connectDB();
    // only keep the personal best per user (lower time = better)
    const existing = await db.collection('leaderboard').findOne({ userId: payload.userId });
    if (existing && existing.completionTime <= completionTime) {
      return res.status(200).json({ ok: true, note: 'Existing score is better' });
    }
    await db.collection('leaderboard').updateOne(
      { userId: payload.userId },
      {
        $set: {
          userId: payload.userId,
          username: payload.username,
          completionTime,
          greenPct:   greenPct   || 0,
          population: population || 0,
          completedAt: new Date(),
        },
      },
      { upsert: true }
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('leaderboard submit error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
