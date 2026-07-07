import { getVapidPublicKey, isPushConfigured } from '../_lib/push.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const publicKey = getVapidPublicKey()
  return res.json({
    configured: isPushConfigured(),
    publicKey,
  })
}
