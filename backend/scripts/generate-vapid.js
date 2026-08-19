/* 生成 Web Push 的 VAPID 密钥对（不需要装任何包）
   运行：node scripts/generate-vapid.js
   把输出填到：1) backend 的环境变量  2) 前端 olh-cloud.js 的 VAPID_PUBLIC_KEY */
import crypto from 'crypto'

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub = publicKey.export({ type: 'spki', format: 'der' }).subarray(-65).toString('base64url')
const priv = privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32).toString('base64url')

console.log('VAPID_PUBLIC_KEY=' + pub)
console.log('VAPID_PRIVATE_KEY=' + priv)
console.log('')
console.log('→ 公钥填进前端 olh-cloud.js 的 VAPID_PUBLIC_KEY')
console.log('→ 两个都填进后端环境变量（Render）')