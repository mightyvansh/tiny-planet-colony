const { connectDB } = require('../_lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const limit = Math.min(Math.max(1, parseInt(req.query.limit || '10', 10)), 50);
  try {
    const db = await connectDB();
    const entries = await db.collection('leaderboard')
      .find({})
      .sort({ completionTime: 1 })
      .limit(limit)
      .toArray();

    return res.status(200).json({
      entries: entries.map((e, i) => ({
        rank: i + 1,
        username: e.username,
        completionTime: e.completionTime,
        greenPct: e.greenPct,
        population: e.population,
        completedAt: e.completedAt,
      })),
    });
  } catch (err) {
    console.error('leaderboard get error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
