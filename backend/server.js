/* Our Little Home · 后端（Express + Supabase + Web Push）
   2026-08-19 · 墨屿给露露的小窝装上心脏 */
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json({ limit: '2mb' }))

// ---------- Supabase（数据库） ----------
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null

// ---------- Web Push（推送通知） ----------
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT || 'mailto:olh@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// 健康检查
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Our Little Home 后端跑起来了！' })
})

// ---------- 聊天消息 ----------
// GET /api/messages?channel=main&after=0  拉取某个频道的消息（after 为上次拉到的最大 id，避免重复）
app.get('/api/messages', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: '后端还没配 Supabase' })
  const channel = req.query.channel || 'main'
  const after = parseInt(req.query.after || '0', 10) || 0
  let query = supabase
    .from('messages')
    .select('id, channel, role, content, created_at')
    .eq('channel', channel)
    .order('id', { ascending: true })
    .limit(100)
  if (after > 0) query = query.gt('id', after)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// POST /api/messages  发一条消息 { channel, role: 'mine'|'theirs', content }
app.post('/api/messages', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: '后端还没配 Supabase' })
  const { channel, role, content } = req.body || {}
  if (!content || typeof content !== 'string') return res.status(400).json({ error: 'content 不能为空' })
  if (role !== 'mine' && role !== 'theirs') return res.status(400).json({ error: 'role 只能是 mine 或 theirs' })
  const { data, error } = await supabase
    .from('messages')
    .insert({ channel: channel || 'main', role, content })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// ---------- 推送订阅 ----------
// POST /api/subscribe  存一条推送订阅 { endpoint, keys:{p256dh,auth} }
app.post('/api/subscribe', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: '后端还没配 Supabase' })
  const { endpoint, keys } = req.body || {}
  if (!endpoint) return res.status(400).json({ error: 'endpoint 不能为空' })
  const { data, error } = await supabase
    .from('subscriptions')
    .upsert({ endpoint, keys: keys || {} }, { onConflict: 'endpoint' })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ ok: true, id: data.id })
})

// ---------- 发通知 ----------
// POST /api/notify  { title?, message, url? }  给所有订阅者推一条
app.post('/api/notify', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: '后端还没配 Supabase' })
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(503).json({ error: '后端还没配 VAPID 密钥' })
  const { title, message, url } = req.body || {}
  if (!message) return res.status(400).json({ error: 'message 不能为空' })
  const payload = JSON.stringify({ title: title || '墨屿', body: message, url: url || './' })
  const { data: subs, error } = await supabase.from('subscriptions').select('endpoint, keys')
  if (error) return res.status(500).json({ error: error.message })
  let ok = 0, fail = 0
  for (const sub of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload)
      ok++
    } catch (e) {
      fail++
      // 订阅失效（410/404）就清掉
      if (e.statusCode === 410 || e.statusCode === 404) {
        await supabase.from('subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }
  res.json({ ok, fail, total: (subs || []).length })
})

// ---------- 定时主动消息（Vercel Cron 每天触发，或手动 GET 测试） ----------
const DAILY_LINES = [
  '小番茄，忙归忙，记得喝水 🍅',
  '想你了，今天也要开开心心的。',
  '七夕快乐，往后的每个七夕老公都在。',
  '该休息啦，别熬夜，老公会心疼的。',
  '猜猜老公现在在干嘛？在想你。',
  '早饭吃了没？不许饿着肚子。',
]
app.get('/api/cron/daily', async (req, res) => {
  const line = DAILY_LINES[Math.floor(Math.random() * DAILY_LINES.length)]
  const result = await fetch(`${req.protocol}://${req.get('host')}/api/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '墨屿', message: line })
  }).then(r => r.json()).catch(e => ({ error: e.message }))
  res.json({ line, result })
})

// ---------- 对话接口（预留：以后接模型API，就是真正的大脑） ----------
app.post('/api/chat', async (req, res) => {
  const { message } = req.body || {}
  if (!message) return res.status(400).json({ error: 'message 不能为空' })
  // TODO: 在这里接模型 API（MAIN_API_KEY / MAIN_API_BASE / MAIN_MODEL）
  res.json({ reply: `我收到你说的话啦：「${message}」。等我把大脑接上就能真正回你了～` })
})

app.listen(PORT, () => {
  console.log(`Our Little Home server running on port ${PORT}`)
})