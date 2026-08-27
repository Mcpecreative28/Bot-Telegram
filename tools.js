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
    'Application-Version': '4.0.0',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

const ampremCooldowns = new Map();
const COOLDOWN_TIME = 60000; // 1 Menit Cooldown

// FUNGSI BYPASS VERIFIKASI ROBOT ALIGHT MOTION NATIVE
async function alightMotionAxios(email, rawLink) {
    try {
        const sessionRes = await axios.get('https://www.alightpro.my.id/api/session', {
            headers: { 'User-Agent': HEADERS['User-Agent'], 'X-Requested-With': 'XMLHttpRequest' },
            timeout: 15000
        });
        const sessionData = sessionRes.data;
        const cookies = sessionRes.headers['set-cookie'] ? sessionRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : '';

        if (!sessionData.status || !sessionData.token) throw new Error('Gagal mendapatkan sesi token dari server.');

        const action = 'verify';
        const prefix = `${sessionData.sessionId}:${sessionData.nonce}:${email.toLowerCase()}:${action}:`;
        let pow = Date.now().toString();
        const difficulty = sessionData.difficulty || '0000';
        
        for (let i = 0; i < 500000; i++) {
            const hash = crypto.createHash('sha256').update(prefix + i.toString()).digest('hex');
            if (hash.startsWith(difficulty)) { pow = i.toString(); break; }
        }

        const submitRes = await axios.post('https://www.alightpro.my.id/api/alight-motion', {
            action, email, link: rawLink
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-Amprem-Token': sessionData.token,
                'X-Amprem-Nonce': sessionData.nonce,
                'X-Amprem-Pow': pow,
                'Cookie': cookies,
                'User-Agent': HEADERS['User-Agent']
            }
        });

        return { success: submitRes.data.status === true, message: submitRes.data.msg || 'Berhasil' };
    } catch (err) {
        return { success: false, error: err.response?.data?.msg || err.message };
    }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = (bot, readDB, writeDB) => {
    bot.onText(/^\/tempmail$/, async (msg) => {
        if (!checkAccess(msg)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Akses ditolak. Command ini hanya di Grup Utama.</blockquote>`, {parse_mode: 'HTML'});

        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        let db = readDB();
        const user = db[userId];

        if (!user) return bot.sendMessage(chatId, `<blockquote>${e.error} Data belum terdaftar. Ketik /start.</blockquote>`, {parse_mode: 'HTML'});
        
        // Cek Limit Berdasarkan Role
        if (user.limit !== "UNLIMITED" && user.limit <= 0) return bot.sendMessage(chatId, `<blockquote>${e.error} Limit harian kamu sudah habis!</blockquote>`, {parse_mode: 'HTML'});

        // Cek Cooldown (1 Menit)
        if (ampremCooldowns.has(userId) && user.limit !== "UNLIMITED") {
            const diff = Date.now() - ampremCooldowns.get(userId);
            if (diff < COOLDOWN_TIME) {
                const timeLeft = Math.ceil((COOLDOWN_TIME - diff) / 1000);
                return bot.sendMessage(chatId, `<blockquote>${e.warn} <b>COOLDOWN AKTIF</b>\nTunggu <b>${timeLeft} detik</b> lagi sebelum membuat akun baru!</blockquote>`, {parse_mode: 'HTML'});
            }
        }

        let waitMsg = await bot.sendMessage(chatId, `<blockquote>${e.loading} <b>MEMBUAT TEMPMAIL</b>\nSedang menyiapkan email menggunakan API Custom...</blockquote>`, {parse_mode: 'HTML'});
        ampremCooldowns.set(userId, Date.now()); // Set cooldown
        
        try {
            // MENGGUNAKAN API CUSTOM (VERCEL) AGAR LEBIH FRESH DAN TIDAK DIBLOKIR
            const mailRes = await axios.get('https://creatett-seven.vercel.app/api/tempmail/create');
            const emailAddr = mailRes.data.email;
            
            if(!emailAddr) throw new Error("API tidak mengembalikan email valid");

            bot.editMessageText(`<blockquote><b>${e.succes} TEMPMAIL SIAP DIGUNAKAN</b>\n\n${e.block_mid} Email: <code>${emailAddr}</code>\n${e.block_end} Status: ${e.loading} Menunggu konfirmasi dari Alight Motion...\n\n<i>Silakan masukkan email di atas ke aplikasi Alight Motion kamu SEKARANG!\nBot akan otomatis mengekstrak link dan memproses lisensi. (Maksimal tunggu: 1.5 Menit)</i></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});

            let attempt = 0;
            let checker = setInterval(async () => {
                attempt++;
                try {
                    // Polling API Inbox Vercel
                    const listRes = await axios.get(`https://creatett-seven.vercel.app/api/tempmail/inbox/${emailAddr}`);
                    const messages = listRes.data;
                    
                    if (Array.isArray(messages) && messages.length > 0) {
                        clearInterval(checker);
                        let magicLink = '';
                        
                        // Ekstraksi Link dari array pesan
                        for (const m of messages) {
                            const emailString = JSON.stringify(m).replace(/\\/g, '');
                            const linkMatch = emailString.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:alightcreative\.com|alight\.link|alightmotion\.com)\/[^\s"'>]*/);
                            if (linkMatch) {
                                magicLink = linkMatch[0].replace(/&/g, '&');
                                break;
                            }
                        }
                        
                        if (magicLink) {
                            bot.editMessageText(`<blockquote><b>${e.loading} MEMPROSES LISENSI</b>\n\n${e.block_mid} Target: <code>${emailAddr}</code>\n${e.block_end} Status: Link ditemukan! Melewati verifikasi sistem...</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                            
                            // PROSES BYPASS & ACTIVATION
                            const result = await alightMotionAxios(emailAddr, magicLink);
                            
                            if (result.success) {
                                // Potong limit jika berhasil
                                db = readDB(); 
                                if (db[userId].limit !== "UNLIMITED") {
                                    db[userId].limit -= 1;
                                    writeDB(db);
                                }
                                let limitText = db[userId].limit === "UNLIMITED" ? "Unlimited" : `${db[userId].limit}/${settings.roleLimits[db[userId].role]}`;
                                
                                bot.editMessageText(`<blockquote><b>${e.succes} AMPREM BERHASIL DIBUAT!</b>\n\n${e.block_mid} Email: <code>${emailAddr}</code>\n${e.block_mid} Status: ${result.message}\n${e.block_end} Sisa Limit: <b>${limitText}</b></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                            } else {
                                ampremCooldowns.delete(userId); // Buka cooldown jika gagal
                                bot.editMessageText(`<blockquote>${e.error} <b>GAGAL PROSES</b>\n\n${e.block_mid} Target: <code>${emailAddr}</code>\n${e.block_end} Detail: ${result.error}</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                            }
                        } else {
                            ampremCooldowns.delete(userId);
                            bot.sendMessage(chatId, `<blockquote>${e.error} Pesan masuk, tetapi Link Verifikasi Alight Motion tidak ditemukan di dalam email.</blockquote>`, {parse_mode: 'HTML'});
                        }
                    } else if (attempt >= 30) { // Timeout ~90 detik
                        clearInterval(checker);
                        ampremCooldowns.delete(userId);
                        bot.editMessageText(`<blockquote>${e.warn} Waktu tunggu habis untuk <code>${emailAddr}</code>. Kemungkinan email diblokir oleh sistem Alight Motion. Silakan buat ulang dengan /tempmail.</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                    }
                } catch(err) {}
            }, 3000);
        } catch(err) {
            ampremCooldowns.delete(userId);
            bot.editMessageText(`<blockquote>${e.error} Gagal mengakses API Tempmail. Coba lagi nanti.</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }
    });
};