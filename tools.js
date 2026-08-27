const axios = require('axios');
const crypto = require('crypto');
const settings = require('./settings');
const e = require('./emojis');

const checkAccess = (msg) => {
    const isOwner = msg.from.id.toString() === settings.ID_KYNO || msg.from.id.toString() === settings.ID_TEMAN;
    return isOwner || msg.chat.id.toString() === settings.GROUP_ID;
};

const HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

const ampremCooldowns = new Map();
const ampremState = new Map();
const COOLDOWN_TIME = 60000;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

// Custom request handler untuk mengatasi Cloudflare 503 / 502
async function fetchWithRetry(url, data, retries = 3) {
    let lastErr;
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await axios.post(url, data, { headers: HEADERS, timeout: 15000 });
            return res;
        } catch (err) {
            lastErr = err;
            if (err.response && (err.response.status === 503 || err.response.status === 502 || err.response.status === 429)) {
                await delay(3000); 
                continue;
            }
            if (err.response && err.response.status === 400) throw err; 
            await delay(2000);
        }
    }
    throw lastErr;
}

// ================= ENGINE 1: RYEZEN STORE =================
async function getRyezenSession() {
    const user = `kn_${generateRandomString(6)}`;
    const pass = `pws${generateRandomString(8)}`;
    try {
        await fetchWithRetry('https://www.ryezenstore.online/api/auth/register', { username: user, password: pass });
        const loginRes = await fetchWithRetry('https://www.ryezenstore.online/api/auth/login', { username: user, password: pass });

        const cookies = loginRes.headers['set-cookie'];
        if (cookies && cookies.length > 0) {
            return cookies.map(c => c.split(';')[0]).join('; ');
        }
        throw new Error("Sesi Cookie gagal di-ekstrak.");
    } catch (err) {
        throw new Error(`Ryezen Error: ${err.response?.data?.error || err.response?.data?.message || err.message}`);
    }
}

async function activateRyezen(email, rawLink, cookie) {
    try {
        const actRes = await axios.post('https://www.ryezenstore.online/api/am/activate', {
            email: email, magicLink: rawLink
        }, {
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie, 'User-Agent': HEADERS['User-Agent'] },
            timeout: 20000
        });
        return { success: true, message: actRes.data.message || 'Lisensi Premium Berhasil Ditambahkan via Engine 1!' };
    } catch (err) {
        return { success: false, error: err.response?.data?.error || err.response?.data?.message || err.message };
    }
}

// ================= ENGINE 2: ALIGHTPRO DIRECT NATIVE =================
async function alightMotionDirectAxios(email, rawLink) {
    try {
        const sessionRes = await axios.get('https://www.alightpro.my.id/api/session', {
            headers: { 'User-Agent': HEADERS['User-Agent'], 'X-Requested-With': 'XMLHttpRequest' }, timeout: 15000
        });
        const sessionData = sessionRes.data;
        const cookies = sessionRes.headers['set-cookie'] ? sessionRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : '';

        if (!sessionData.status || !sessionData.token) throw new Error('Gagal memuat token otentikasi server.');

        const prefix = `${sessionData.sessionId}:${sessionData.nonce}:${email.toLowerCase()}:verify:`;
        let pow = Date.now().toString();
        const difficulty = sessionData.difficulty || '0000';
        
        for (let i = 0; i < 500000; i++) {
            const hash = crypto.createHash('sha256').update(prefix + i.toString()).digest('hex');
            if (hash.startsWith(difficulty)) { pow = i.toString(); break; }
        }

        const submitRes = await axios.post('https://www.alightpro.my.id/api/alight-motion', {
            action: 'verify', email, link: rawLink
        }, {
            headers: {
                'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest',
                'X-Amprem-Token': sessionData.token, 'X-Amprem-Nonce': sessionData.nonce, 'X-Amprem-Pow': pow,
                'Cookie': cookies, 'User-Agent': HEADERS['User-Agent']
            }
        });

        return { success: submitRes.data.status === true, message: submitRes.data.msg || 'Lisensi Berhasil Ditambahkan via Engine 2!' };
    } catch (err) {
        let errorMsg = err.response?.data?.msg || err.message;
        if (errorMsg.includes("unavailable in your region")) errorMsg = "Terblokir oleh Cloudflare (Region Block).";
        return { success: false, error: errorMsg };
    }
}

module.exports = (bot, readDB, writeDB) => {
    bot.onText(/^\/tempmail$/, async (msg) => {
        if (!checkAccess(msg)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Akses ditolak. Command ini hanya di Grup Utama.</blockquote>`, {parse_mode: 'HTML'});

        const chatId = msg.chat.id;
        let waitMsg = await bot.sendMessage(chatId, `<blockquote>${e.loading} <b>MEMBUAT TEMPMAIL</b>\nSedang menyiapkan email menggunakan API Custom...</blockquote>`, {parse_mode: 'HTML'});
        
        try {
            const mailRes = await axios.get('https://creatett-seven.vercel.app/api/tempmail/create');
            const emailAddr = mailRes.data.email;
            if(!emailAddr) throw new Error("API tidak mengembalikan email valid");

            bot.editMessageText(`<blockquote><b>${e.succes} TEMPMAIL SIAP DIGUNAKAN</b>\n\n${e.block_mid} Email: <code>${emailAddr}</code>\n${e.block_end} Status: ${e.loading} Menunggu konfirmasi...\n\n<i>Masukkan email ini ke aplikasi Alight Motion kamu SEKARANG!\nJika ada email masuk, bot akan menampilkan Link-nya di sini.</i></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});

            let attempt = 0;
            let checker = setInterval(async () => {
                attempt++;
                try {
                    const listRes = await axios.get(`https://creatett-seven.vercel.app/api/tempmail/inbox/${emailAddr}`);
                    const messages = listRes.data;
                    
                    if (Array.isArray(messages) && messages.length > 0) {
                        clearInterval(checker);
                        let magicLink = '';
                        
                        for (const m of messages) {
                            const emailString = JSON.stringify(m).replace(/\\/g, '');
                            const linkMatch = emailString.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:alightcreative\.com|alight\.link|alightmotion\.com)\/[^\s"'>]*/);
                            if (linkMatch) {
                                magicLink = linkMatch[0].replace(/&amp;/g, '&').replace(/&/g, '&');
                                break;
                            }
                        }
                        
                        if (magicLink) {
                            bot.sendMessage(chatId, `<blockquote><b>${e.chat} LINK OOB DITEMUKAN!</b>\n\n${e.block_mid} Email: <code>${emailAddr}</code>\n${e.block_end} Link:\n<code>${magicLink}</code>\n\n<i>Silakan salin link di atas dan jalankan proses verifikasi menggunakan command:</i>\n<code>/amprem ${emailAddr}</code></blockquote>`, {parse_mode: 'HTML'});
                        } else {
                            bot.sendMessage(chatId, `<blockquote>${e.error} Email masuk, tapi Link Verifikasi tidak ditemukan.</blockquote>`, {parse_mode: 'HTML'});
                        }
                    } else if (attempt >= 40) { 
                        clearInterval(checker);
                        bot.sendMessage(chatId, `<blockquote>${e.warn} Waktu tunggu habis untuk <code>${emailAddr}</code>. Silakan buat ulang.</blockquote>`, {parse_mode: 'HTML'});
                    }
                } catch(err) {}
            }, 3000);
        } catch(err) {
            bot.editMessageText(`<blockquote>${e.error} Gagal membuat Tempmail API. Coba lagi nanti.</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }
    });

    bot.onText(/^\/amprem(?:\s+(.+))?$/, async (msg, match) => {
        if (!checkAccess(msg)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Akses ditolak. Command ini hanya di Grup Utama.</blockquote>`, {parse_mode: 'HTML'});

        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        
        let db = readDB();
        const user = db[userId];
        if (!user) return bot.sendMessage(chatId, `<blockquote>${e.error} Data belum terdaftar. Ketik /start.</blockquote>`, {parse_mode: 'HTML'});

        const inputArgs = match[1];

        if (inputArgs && inputArgs.includes('http')) {
            return bot.sendMessage(chatId, `<blockquote>${e.error} JANGAN MENGIRIM LINK DI SINI!\nGunakan: <code>/amprem email@domain.com</code>\nBot akan meminta link-nya di pesan selanjutnya.</blockquote>`, {parse_mode: 'HTML'});
        }

        if (!inputArgs || !inputArgs.includes('@')) {
            return bot.sendMessage(chatId, `<blockquote>${e.error} Format salah!\nGunakan: <code>/amprem email@domain.com</code></blockquote>`, {parse_mode: 'HTML'});
        }

        const email = inputArgs.trim();

        if (user.limit !== "UNLIMITED" && user.limit <= 0) return bot.sendMessage(chatId, `<blockquote>${e.error} Limit harian kamu sudah habis!</blockquote>`, {parse_mode: 'HTML'});

        ampremState.set(userId, { email, chatId });

        bot.sendMessage(chatId, `<blockquote><b>${e.loading} MENUNGGU MAGIC LINK</b>\n\n${e.block_mid} Target: <code>${email}</code>\n${e.block_end} Status: Menunggu kamu mengirimkan OOB Link...\n\n<i>Kirim link Alight Motion ke chat ini sekarang.\nKetik <code>/cancel</code> untuk membatalkan proses.</i></blockquote>`, {parse_mode: 'HTML'});
    });

    bot.on('message', async (msg) => {
        const userId = msg.from.id.toString();
        if (!msg.text) return;
        const text = msg.text.trim();

        if (text.toLowerCase() === '/cancel' && ampremState.has(userId)) {
            ampremState.delete(userId);
            return bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Proses Amprem dibatalkan.</blockquote>`, {parse_mode: 'HTML'});
        }

        if (ampremState.has(userId)) {
            const state = ampremState.get(userId);
            if (msg.chat.id !== state.chatId) return; 
            if (text.startsWith('/')) return;

            const linkMatch = text.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:alightcreative\.com|alight\.link|alightmotion\.com)\/[^\s"'>]*/);
            
            if (linkMatch) {
                const link = linkMatch[0].replace(/&amp;/g, '&').replace(/&/g, '&');
                ampremState.delete(userId); 

                let db = readDB();
                const user = db[userId];
                
                if (ampremCooldowns.has(userId) && user.limit !== "UNLIMITED") {
                    const diff = Date.now() - ampremCooldowns.get(userId);
                    if (diff < COOLDOWN_TIME) {
                        const timeLeft = Math.ceil((COOLDOWN_TIME - diff) / 1000);
                        return bot.sendMessage(state.chatId, `<blockquote>${e.warn} <b>COOLDOWN AKTIF</b>\nTunggu <b>${timeLeft} detik</b> lagi sebelum membuat amprem!</blockquote>`, {parse_mode: 'HTML'});
                    }
                }

                const waitMsg = await bot.sendMessage(state.chatId, `<blockquote>${e.loading} <b>MEMPROSES AMPREM</b>\n\n${e.block_mid} Target: <code>${state.email}</code>\n${e.block_end} Status: Mengirim request melalui Engine 1 (Ryezen)...</blockquote>`, {parse_mode: 'HTML'});
                ampremCooldowns.set(userId, Date.now());

                let isSuccess = false;
                let finalMessage = "";
                let debugError = "";

                try {
                    // Coba Engine 1
                    const sessionCookie = await getRyezenSession();
                    const res1 = await activateRyezen(state.email, link, sessionCookie);
                    if (res1.success) {
                        isSuccess = true;
                        finalMessage = res1.message;
                    } else {
                        throw new Error(res1.error);
                    }
                } catch (err1) {
                    debugError += `E1: ${err1.message} | `;
                    bot.editMessageText(`<blockquote>${e.loading} <b>MEMPROSES AMPREM</b>\n\n${e.block_mid} Target: <code>${state.email}</code>\n${e.block_mid} Error 1: <code>${err1.message.substring(0,40)}...</code>\n${e.block_end} Status: Mengalihkan ke Engine 2 (Direct)...</blockquote>`, {chat_id: state.chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                    
                    // Coba Engine 2 (Fallback)
                    const res2 = await alightMotionDirectAxios(state.email, link);
                    if (res2.success) {
                        isSuccess = true;
                        finalMessage = res2.message;
                    } else {
                        debugError += `E2: ${res2.error}`;
                    }
                }

                if (isSuccess) {
                    db = readDB(); 
                    if (db[userId].limit !== "UNLIMITED") {
                        db[userId].limit -= 1;
                        writeDB(db);
                    }
                    let limitText = db[userId].limit === "UNLIMITED" ? "Unlimited" : `${db[userId].limit}/${settings.roleLimits[db[userId].role]}`;
                    
                    bot.editMessageText(`<blockquote><b>${e.succes} AMPREM BERHASIL DIBUAT!</b>\n\n${e.block_mid} Email: <code>${state.email}</code>\n${e.block_mid} Info: ${finalMessage}\n${e.block_end} Sisa Limit: <b>${limitText}</b></blockquote>`, {chat_id: state.chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                } else {
                    ampremCooldowns.delete(userId); 
                    bot.editMessageText(`<blockquote>${e.error} <b>GAGAL PROSES TOTAL</b>\n\n${e.block_mid} Target: <code>${state.email}</code>\n${e.block_end} Log: <code>${debugError}</code></blockquote>`, {chat_id: state.chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                }
            } else {
                bot.sendMessage(state.chatId, `<blockquote>${e.error} Itu bukan link verifikasi yang valid!\nSilakan kirim link Alight Motion atau ketik <code>/cancel</code>.</blockquote>`, {parse_mode: 'HTML'});
            }
        }
    });
};