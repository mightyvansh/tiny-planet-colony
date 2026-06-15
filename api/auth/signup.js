const { connectDB } = require('../_lib/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, email, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });
  if (username.length < 3 || username.length > 20)
    return res.status(400).json({ error: 'Username must be 3–20 characters' });
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.status(400).json({ error: 'Username may only contain letters, numbers and underscores' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const db = await connectDB();
    const users = db.collection('users');
    const existing = await users.findOne({ usernameLower: username.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    const passwordHash = await bcrypt.hash(password, 10);
    const doc = {
      username,
      usernameLower: username.toLowerCase(),
      email: email || '',
      passwordHash,
      createdAt: new Date(),
    };
    const result = await users.insertOne(doc);
    const token = jwt.sign(
      { userId: result.insertedId.toString(), username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    return res.status(201).json({ token, user: { id: result.insertedId, username } });
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
