const axios = require('axios');
const crypto = require('crypto');
const { HttpsProxyAgent } = require('https-proxy-agent');
const settings = require('./settings');
const e = require('./emojis');

const checkAccess = (msg) => {
    const isOwner = msg.from.id.toString() === settings.ID_KYNO || msg.from.id.toString() === settings.ID_TEMAN;
    return isOwner || msg.chat.id.toString() === settings.GROUP_ID;
};

const ampremCooldowns = new Map();
const ampremState = new Map(); // Menyimpan state { email, chatId }
const COOLDOWN_TIME = 60000;

// ================= ENGINE TUNGGAL: ALIGHTPRO NATIVE =================
async function alightMotionAxios(email, rawLink = null) {
    let axiosConfig = {
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://www.alightpro.my.id',
            'Referer': 'https://www.alightpro.my.id/'
        },
        timeout: 25000
    };

    // Inject Proxy dari settings.js agar bisa menembus Region Block Cloudflare
    if (settings.PROXY_HOST && settings.PROXY_PORT) {
        const proxyUrl = `http://${settings.PROXY_HOST}:${settings.PROXY_PORT}`;
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
        axiosConfig.proxy = false; 
    }

    try {
        // 1. Dapatkan Sesi Browser & Token
        const sessionRes = await axios.get('https://www.alightpro.my.id/api/session', axiosConfig);
        const sessionData = sessionRes.data;
        const cookies = sessionRes.headers['set-cookie'] ? sessionRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : '';

        if (!sessionData.status || !sessionData.token) throw new Error('Gagal mendapatkan sesi token dari server AlightPro.');

        const action = rawLink ? 'verify' : 'send';
        const prefix = `${sessionData.sessionId}:${sessionData.nonce}:${email.toLowerCase()}:${action}:`;
        let pow = Date.now().toString();
        const difficulty = sessionData.difficulty || '0000';
        
        // 2. Kalkulasi Bypass Anti-Bot (Proof of Work)
        for (let i = 0; i < 500000; i++) {
            const hash = crypto.createHash('sha256').update(prefix + i.toString()).digest('hex');
            if (hash.startsWith(difficulty)) { pow = i.toString(); break; }
        }

        // 3. Tembak API
        let postConfig = { ...axiosConfig };
        postConfig.headers['Content-Type'] = 'application/json';
        postConfig.headers['X-Amprem-Token'] = sessionData.token;
        postConfig.headers['X-Amprem-Nonce'] = sessionData.nonce;
        postConfig.headers['X-Amprem-Pow'] = pow;
        postConfig.headers['Cookie'] = cookies;

        const payload = { action, email };
        if (rawLink) payload.link = rawLink;

        const submitRes = await axios.post('https://www.alightpro.my.id/api/alight-motion', payload, postConfig);

        return { success: submitRes.data.status === true, message: submitRes.data.msg || 'Aksi Berhasil!' };
    } catch (err) {
        let errorMsg = err.response?.data?.msg || err.response?.data?.error || err.message;
        
        if (errorMsg.includes("unavailable in your region") || errorMsg.includes("403 Forbidden")) {
            errorMsg = "Terblokir Cloudflare. Wajib ganti IP Proxy Indonesia di settings.js!";
        } else if (errorMsg.includes("ECONNRESET") || errorMsg.includes("timeout") || errorMsg.includes("socket hang up")) {
            errorMsg = "Koneksi Proxy Mati/Terputus. Ganti IP Proxy!";
        }
        return { success: false, error: errorMsg };
    }
}
// ====================================================================

module.exports = (bot, readDB, writeDB) => {
    // FITUR 1: TEMPMAIL
    bot.onText(/^\/tempmail$/, async (msg) => {
        if (!checkAccess(msg)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Akses ditolak. Command ini hanya di Grup Utama.</blockquote>`, {parse_mode: 'HTML'});

        const chatId = msg.chat.id;
        let waitMsg = await bot.sendMessage(chatId, `<blockquote>${e.loading} <b>MEMBUAT TEMPMAIL</b>\nSedang menyiapkan email sementara...</blockquote>`, {parse_mode: 'HTML'});
        
        try {
            const mailRes = await axios.get('https://creatett-seven.vercel.app/api/tempmail/create');
            const emailAddr = mailRes.data.email;
            if(!emailAddr) throw new Error("API tidak mengembalikan email valid");

            bot.editMessageText(`<blockquote><b>${e.succes} TEMPMAIL SIAP DIGUNAKAN</b>\n\n${e.block_mid} Email: <code>${emailAddr}</code>\n${e.block_end} Status: ${e.loading} Memantau pesan masuk (Maks 2 Menit)\n\n<i>Ketik:</i>\n<code>/amprem ${emailAddr}</code>\n<i>sekarang juga untuk memicu link otomatis!</i></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});

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
                            bot.sendMessage(chatId, `<blockquote><b>${e.chat} LINK OOB DITEMUKAN!</b>\n\n${e.block_mid} Email: <code>${emailAddr}</code>\n${e.block_end} Link:\n<code>${magicLink}</code>\n\n<i>Silakan salin link di atas dan tempel di chat ini untuk menyelesaikan proses Amprem.</i></blockquote>`, {parse_mode: 'HTML'});
                        } else {
                            bot.sendMessage(chatId, `<blockquote>${e.error} Email masuk, tapi Link Verifikasi tidak ditemukan.</blockquote>`, {parse_mode: 'HTML'});
                        }
                    } else if (attempt >= 40) { 
                        clearInterval(checker);
                        bot.sendMessage(chatId, `<blockquote>${e.warn} Pemantauan dihentikan untuk <code>${emailAddr}</code>. Tidak ada pesan masuk.</blockquote>`, {parse_mode: 'HTML'});
                    }
                } catch(err) {}
            }, 3000);
        } catch(err) {
            bot.editMessageText(`<blockquote>${e.error} Gagal membuat Tempmail API. Coba lagi nanti.</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }
    });

    // FITUR 2: INISIASI AMPREM (Tahap 1 - Memicu Link)
    bot.onText(/^\/amprem(?:\s+(.+))?$/, async (msg, match) => {
        if (!checkAccess(msg)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Akses ditolak. Command ini hanya di Grup Utama.</blockquote>`, {parse_mode: 'HTML'});

        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        
        let db = readDB();
        const user = db[userId];
        if (!user) return bot.sendMessage(chatId, `<blockquote>${e.error} Data belum terdaftar. Ketik /start.</blockquote>`, {parse_mode: 'HTML'});

        const inputArgs = match[1];

        if (inputArgs && inputArgs.includes('http')) {
            return bot.sendMessage(chatId, `<blockquote>${e.error} JANGAN MENGIRIM LINK DI SINI!\nGunakan: <code>/amprem email@domain.com</code>\nBot akan memicu link-nya secara otomatis.</blockquote>`, {parse_mode: 'HTML'});
        }

        if (!inputArgs || !inputArgs.includes('@')) {
            return bot.sendMessage(chatId, `<blockquote>${e.error} Format salah!\nGunakan: <code>/amprem email@domain.com</code></blockquote>`, {parse_mode: 'HTML'});
        }

        const email = inputArgs.trim();

        if (user.limit !== "UNLIMITED" && user.limit <= 0) return bot.sendMessage(chatId, `<blockquote>${e.error} Limit harian kamu sudah habis!</blockquote>`, {parse_mode: 'HTML'});

        let waitMsg = await bot.sendMessage(chatId, `<blockquote>${e.loading} <b>MENYIAPKAN SESI ALIGHTPRO</b>\n\nMeminta server untuk mengirimkan Magic Link ke email...</blockquote>`, {parse_mode: 'HTML'});

        // Memicu API AlightPro untuk mengirim email verifikasi (action = 'send')
        const sendRes = await alightMotionAxios(email, null);
        
        if (!sendRes.success) {
            return bot.editMessageText(`<blockquote>${e.error} <b>GAGAL MEMICU EMAIL</b>\n\nDetail: <code>${sendRes.error}</code></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }

        // Simpan Sesi (Tunggu user mengirim link)
        ampremState.set(userId, { email, chatId });

        bot.editMessageText(`<blockquote><b>${e.loading} MENUNGGU MAGIC LINK</b>\n\n${e.block_mid} Target: <code>${email}</code>\n${e.block_end} Status: Link Verifikasi telah dikirim ke email tersebut!\n\n<i>Tunggu link-nya muncul dari tempmail, lalu salin dan kirimkan link tersebut ke chat ini.\nKetik <code>/cancel</code> untuk membatalkan proses.</i></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
    });

    // FITUR 3: LISTENER MAGIC LINK (Tahap 2 - Mengeksekusi Link)
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
                const userStateEmail = state.email;
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

                const waitMsg = await bot.sendMessage(state.chatId, `<blockquote>${e.loading} <b>MEMPROSES AKTIVASI LISENSI</b>\n\n${e.block_mid} Target: <code>${userStateEmail}</code>\n${e.block_end} Status: Mengirim link ke AlightPro...</blockquote>`, {parse_mode: 'HTML'});
                ampremCooldowns.set(userId, Date.now());

                // Eksekusi API AlightPro untuk verifikasi link (action = 'verify')
                const actRes = await alightMotionAxios(userStateEmail, link);

                if (actRes.success) {
                    db = readDB(); 
                    if (db[userId].limit !== "UNLIMITED") {
                        db[userId].limit -= 1;
                        writeDB(db);
                    }
                    let limitText = db[userId].limit === "UNLIMITED" ? "Unlimited" : `${db[userId].limit}/${settings.roleLimits[db[userId].role]}`;
                    
                    bot.editMessageText(`<blockquote><b>${e.succes} AMPREM BERHASIL DIBUAT!</b>\n\n${e.block_mid} Email: <code>${userStateEmail}</code>\n${e.block_mid} Info: ${actRes.message}\n${e.block_end} Sisa Limit: <b>${limitText}</b></blockquote>`, {chat_id: state.chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                } else {
                    ampremCooldowns.delete(userId); 
                    bot.editMessageText(`<blockquote>${e.error} <b>GAGAL PROSES LISENSI</b>\n\n${e.block_mid} Target: <code>${userStateEmail}</code>\n${e.block_end} Detail: <code>${actRes.error}</code></blockquote>`, {chat_id: state.chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                }
            } else {
                bot.sendMessage(state.chatId, `<blockquote>${e.error} Itu bukan link verifikasi yang valid!\nSilakan kirim link Alight Motion atau ketik <code>/cancel</code>.</blockquote>`, {parse_mode: 'HTML'});
            }
        }
    });
};