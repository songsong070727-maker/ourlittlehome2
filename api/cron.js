/* Vercel 定时任务：每天 09:00 叫醒 Render 后端，让它给露露发一条主动消息 */
export default async function handler(req, res) {
  const backend = process.env.OLH_BACKEND_URL
  if (!backend) return res.status(500).json({ error: '没配 OLH_BACKEND_URL 环境变量' })
  try {
    const r = await fetch(backend + '/api/cron/daily')
    const data = await r.json()
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}