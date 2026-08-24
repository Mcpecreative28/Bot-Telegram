const axios = require('axios');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const settings = require('./settings');
const e = require('./emojis');

const checkAccess = (msg) => {
    const isOwner = msg.from.id.toString() === settings.ID_KYNO || msg.from.id.toString() === settings.ID_TEMAN;
    return isOwner || msg.chat.id.toString() === settings.GROUP_ID;
};

// =================== SCAPPER ALIGHT MOTION ===================
const CONFIG = {
    BASE_URL: 'https://www.alightpro.my.id',
    TIMEOUT: 60000,
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    MAX_POW_ATTEMPTS: 500000
};

function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

async function generatePow(sessionId, nonce, email, action, difficulty = '0000') {
    const prefix = `${sessionId}:${nonce}:${email.toLowerCase()}:${action}:`;
    for (let i = 0; i < CONFIG.MAX_POW_ATTEMPTS; i++) {
        const hash = sha256(prefix + i.toString());
        if (hash.startsWith(difficulty)) return i.toString();
    }
    return Date.now().toString();
}

async function alightMotion(email, rawLink = null) {
    let browser;
    try {
        if (!email || !email.includes('@')) return { success: false, error: 'Email tidak valid.' };

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setUserAgent(CONFIG.USER_AGENT);

        await page.goto(CONFIG.BASE_URL, { waitUntil: 'networkidle0', timeout: CONFIG.TIMEOUT });

        const sessionData = await page.evaluate(async (baseUrl) => {
            const res = await fetch(baseUrl + '/api/session', {
                method: 'GET', headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.msg || 'Gagal sesi browser.');
            }
            return await res.json();
        }, CONFIG.BASE_URL);

        if (!sessionData.status || !sessionData.token || !sessionData.nonce) {
            throw new Error('Token otentikasi browser tidak valid.');
        }

        const action = rawLink ? 'verify' : 'send';
        const pow = await generatePow(sessionData.sessionId, sessionData.nonce, email, action, sessionData.difficulty || '0000');

        const apiResult = await page.evaluate(async (params) => {
            const headers = {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-Amprem-Token': params.token,
                'X-Amprem-Nonce': params.nonce,
                'X-Amprem-Pow': params.pow
            };
            const body = { action: params.action, email: params.email };
            if (params.link) body.link = params.link;

            const res = await fetch(params.baseUrl + '/api/alight-motion', {
                method: 'POST', headers, body: JSON.stringify(body)
            });
            return await res.json();
        }, { baseUrl: CONFIG.BASE_URL, email, action, link: rawLink, token: sessionData.token, nonce: sessionData.nonce, pow });

        return { success: apiResult.status === true, email: email, message: apiResult.msg || 'Selesai.' };
    } catch (error) {
        return { success: false, error: error.message };
    } finally {
        if (browser) await browser.close();
    }
}
// ==============================================================

module.exports = (bot) => {
    bot.onText(/^\/tempmail$/, async (msg) => {
        if (!checkAccess(msg)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Akses ditolak. Command ini hanya di Grup Utama.</blockquote>`, {parse_mode: 'HTML'});

        const chatId = msg.chat.id;
        let waitMsg = await bot.sendMessage(chatId, `<blockquote>${e.loading} Sedang membuat tempmail...</blockquote>`, {parse_mode: 'HTML'});
        
        try {
            const res = await axios.post('https://api.internal.temp-mail.io/api/v3/email/new', { min_name_length: 10, max_name_length: 10 }, { headers: { 'Content-Type': 'application/json', 'Application-Version': '4.0.0' } });
            const acc = res.data;
            if(!acc) throw new Error();

            bot.editMessageText(`<blockquote><b>${e.succes} TEMPMAIL DIBUAT</b>\n\n${e.block_mid} Email: <code>${acc.email}</code>\n${e.block_end} Token: <code>${acc.token}</code>\n\n<i>${e.loading} Menunggu pesan masuk (Maks 1.5 Menit)...</i></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});

            let attempt = 0;
            let checker = setInterval(async () => {
                attempt++;
                try {
                    const msgsRes = await axios.get(`https://api.internal.temp-mail.io/api/v3/email/${acc.email}/messages`);
                    const msgs = msgsRes.data;
                    if (msgs.length > 0) {
                        clearInterval(checker);
                        const m = msgs[0];
                        const otpMatch = m.body_text.match(/\b\d{4,8}\b/);
                        bot.sendMessage(chatId, `<blockquote><b>${e.chat} INBOX MASUK!</b>\n\n${e.block_mid} Dari: ${m.from}\n${e.block_mid} Subjek: ${m.subject}\n${e.block_mid} OTP: <code>${otpMatch ? otpMatch[0] : '-'}</code>\n${e.block_end} Pesan:\n${m.body_text.substring(0, 300)}...</blockquote>`, {parse_mode: 'HTML'});
                    } else if (attempt >= 30) {
                        clearInterval(checker);
                        bot.sendMessage(chatId, `<blockquote>${e.warn} Inbox timeout untuk <code>${acc.email}</code>.</blockquote>`, {parse_mode: 'HTML'});
                    }
                } catch(err) {}
            }, 3000);
        } catch(err) {
            bot.editMessageText(`<blockquote>${e.error} Error System Tempmail.</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }
    });

    bot.onText(/^\/amprem(?:\s+([^\s]+))?(?:\s+(.+))?$/, async (msg, match) => {
        if (!checkAccess(msg)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Akses ditolak. Command ini hanya di Grup Utama.</blockquote>`, {parse_mode: 'HTML'});

        const email = match[1];
        const link = match[2];

        if (!email) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/amprem email@domain.com [link_verifikasi]</code></blockquote>`, {parse_mode: 'HTML'});

        const waitMsg = await bot.sendMessage(msg.chat.id, `<blockquote>${e.loading} <b>MEMPROSES AMPREM</b>\n\n${e.block_mid} Target: ${email}\n${e.block_end} Status: Menjalankan Browser...</blockquote>`, {parse_mode: 'HTML'});

        try {
            const result = await alightMotion(email, link);
            if (result.success) {
                bot.editMessageText(`<blockquote><b>${e.succes} AMPREM SUKSES</b>\n\n${e.block_mid} Email: <code>${result.email}</code>\n${e.block_end} Pesan: ${result.message}</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
            } else {
                bot.editMessageText(`<blockquote>${e.error} <b>GAGAL PROSES</b>\n\n${e.block_end} Detail: ${result.error}</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
            }
        } catch(err) {
            bot.editMessageText(`<blockquote>${e.error} <b>SYSTEM ERROR</b>\n\n${e.block_end} Detail: ${err.message}</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }
    });
};