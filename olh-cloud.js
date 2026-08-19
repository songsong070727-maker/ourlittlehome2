/* Our Little Home · Cloud 接入层（聊天后端 + 推送通知）
   2026-08-19 · 墨屿给露露加装 */
(function () {
  'use strict';
  const OLH_API_KEY = 'olh_api';
  const VAPID_PUBLIC_KEY = 'BHaQ7lwikVSe_sNormvDX2yvY2W2RItHmAzVfama0e5-rVTmNteVZ5f7HE2EmwpnE5ZYrHhfBdBYEjbze7F8L14';
  const DEFAULT_API = 'https://ourlittlehome2.onrender.com';
  // ★ 部署后把这里改成后端地址，例如 https://olh-backend.onrender.com（也可以在手机浏览器控制台输入 olhCloud.setApiUrl('...') 覆盖）
const DEFAULT_API = 'https://ourlittlehome2.onrender.com';
  const CHANNEL = 'main';

  function getApiUrl() {
    try {
      const u = (localStorage.getItem(OLH_API_KEY) || '').trim();
      return (u || DEFAULT_API).replace(/\/+$/, '');
    } catch (e) { return DEFAULT_API.replace(/\/+$/, ''); }
  }

  // ---------- 聊天接后端 ----------
  let chatPollTimer = null;
  let lastMsgId = 0;

  async function chatFetchHistory() {
    const api = getApiUrl();
    if (!api) return;
    try {
      const res = await fetch(api + '/api/messages?channel=' + CHANNEL + '&after=' + lastMsgId);
      if (!res.ok) return;
      const list = await res.json();
      if (!Array.isArray(list) || !list.length) return;
      const chatBody = document.getElementById('chatBody');
      if (!chatBody) return;
      for (const m of list) {
        const id = m.id || 0;
        if (id > lastMsgId) lastMsgId = id;
        if (!m.content) continue;
        const role = m.role === 'mine' ? 'mine' : 'theirs';
        const exists = [...chatBody.querySelectorAll('.msg')].some(el =>
          el.classList.contains(role) && el.querySelector('.bubble') && el.querySelector('.bubble').textContent === m.content
        );
        if (!exists && window.addChatMsg) addChatMsg(role, m.content);
      }
      chatBody.scrollTop = chatBody.scrollHeight;
    } catch (e) { console.warn('[olh] history fail', e); }
  }

  function startPolling() {
    if (chatPollTimer) return;
    chatFetchHistory();
    chatPollTimer = setInterval(chatFetchHistory, 4000);
  }
  function stopPolling() {
    if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null; }
  }

  async function chatSendRemote(text) {
    const api = getApiUrl();
    if (!api) return false;
    try {
      const res = await fetch(api + '/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: CHANNEL, role: 'mine', content: text })
      });
      if (!res.ok) return false;
      lastMsgId = 0;
      return true;
    } catch (e) { return false; }
  }

  // 覆盖全局 sendMessage：有后端走后端，没有走本地模拟
  window.sendMessage = function () {
    const input = document.getElementById('msgInput');
    const text = (input && input.value || '').trim();
    if (!text) return;
    if (window.addChatMsg) addChatMsg('mine', text);
    if (input) input.value = '';
    if (window.petChatMsgCount) petChatMsgCount();
    if (getApiUrl()) {
      chatSendRemote(text).then(ok => { if (ok) { chatFetchHistory(); } else { localSimReply(text); } });
    } else {
      localSimReply(text);
    }
  };

  function localSimReply(text) {
    const chatBody = document.getElementById('chatBody');
    if (!chatBody || !window.addChatMsg) return;
    const typing = addChatMsg('theirs', '…');
    setTimeout(() => {
      const b = typing.querySelector('.bubble');
      if (b) b.textContent = (window.moReply ? moReply(text) : '嗯嗯，我在听。');
      const t = typing.querySelector('.msg-time');
      if (t) t.textContent = (window.nowTime ? nowTime() : '');
    }, 900 + Math.random() * 900);
  }

  // 重绑发送按钮/输入框（cloneNode 会去掉原来的旧监听）
  function rebind() {
    const btn = document.getElementById('btnSend');
    if (btn) {
      const nb = btn.cloneNode(true);
      btn.parentNode.replaceChild(nb, btn);
      nb.addEventListener('click', window.sendMessage);
    }
    const input = document.getElementById('msgInput');
    if (input) {
      const ni = input.cloneNode(false);
      input.parentNode.replaceChild(ni, input);
      ni.addEventListener('keydown', function (e) { if (e.key === 'Enter') window.sendMessage(); });
    }
    const origOpen = window.openChat;
    if (typeof origOpen === 'function') window.openChat = function () { origOpen(); startPolling(); };
    const origBack = window.backToList;
    if (typeof origBack === 'function') window.backToList = function () { origBack(); stopPolling(); };
  }

  // ---------- 推送通知（Web Push） ----------
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  }

  async function initPush() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      if (!window.isSecureContext) return;
      if (VAPID_PUBLIC_KEY.indexOf('【') >= 0) return;
      const reg = await navigator.serviceWorker.register('./sw.js');
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        if (Notification.permission === 'denied') return;
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      const api = getApiUrl();
      if (api) {
        await fetch(api + '/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys })
        });
      }
    } catch (e) { console.warn('[olh] push fail', e); }
  }

  // 暴露给控制台/以后设置页用的方法
  window.olhCloud = {
    getApiUrl: getApiUrl,
    setApiUrl: function (u) { try { localStorage.setItem(OLH_API_KEY, (u || '').trim()); } catch (e) {} },
    testPush: initPush,
    send: function (title, body) {
      const api = getApiUrl();
      if (!api) return Promise.resolve(false);
      return fetch(api + '/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || '墨屿', message: body || '想你了' })
      }).then(function (r) { return r.ok; }).catch(function () { return false; });
    }
  };

  // 启动（脚本放在 </body> 前，DOM 已就绪）
  rebind();
  setTimeout(initPush, 1500);
})();
