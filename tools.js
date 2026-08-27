const axios = require('axios');
const crypto = require('crypto');
const settings = require('./settings');
const e = require('./emojis');

const checkAccess = (msg) => {
    const isOwner = msg.from.id.toString() === settings.ID_KYNO || msg.from.id.toString() === settings.ID_TEMAN;
    return isOwner || msg.chat.id.toString() === settings.GROUP_ID;
};

// Menambahkan Fake IP Header (Spoofing) untuk mencoba membypass Region Block dari VPS
const HEADERS = {
    'Content-Type': 'application/json',
    'Application-Version': '4.0.0',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'X-Forwarded-For': '114.124.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255)
};

const ampremCooldowns = new Map();
const ampremState = new Map();

// FUNGSI BYPASS VERIFIKASI ROBOT ALIGHT MOTION NATIVE
async function alightMotionAxios(email, rawLink) {
    try {
        const sessionRes = await axios.get('https://www.alightpro.my.id/api/session', {
            headers: { 'User-Agent': HEADERS['User-Agent'], 'X-Requested-With': 'XMLHttpRequest', 'X-Forwarded-For': HEADERS['X-Forwarded-For'] },
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
                'User-Agent': HEADERS['User-Agent'],
                'X-Forwarded-For': HEADERS['X-Forwarded-For']
            }
        });

        return { success: submitRes.data.status === true, message: submitRes.data.msg || 'Berhasil' };
    } catch (err) {
        let errorMsg = err.response?.data?.msg || err.message;
        // Penjelasan otomatis jika masih terkena Geo-block VPS
        if (errorMsg.includes("unavailable in your region")) {
            errorMsg += "\n\n<i>*Info: Ini berarti API Alight Motion memblokir IP VPS kamu secara permanen.</i>";
        }
        return { success: false, error: errorMsg };
    }
}

module.exports = (bot, readDB, writeDB) => {
    // FITUR 1: TEMPMAIL (Hanya memberikan email dan mengekstrak link)
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
                                magicLink = linkMatch[0].replace(/&/g, '&');
                                break;
                            }
                        }
                        
                        if (magicLink) {
                            bot.sendMessage(chatId, `<blockquote><b>${e.chat} LINK OOB DITEMUKAN!</b>\n\n${e.block_mid} Email: <code>${emailAddr}</code>\n${e.block_end} Link:\n<code>${magicLink}</code>\n\n<i>Silakan salin link di atas dan jalankan proses verifikasi menggunakan command:</i>\n<code>/amprem ${emailAddr}</code></blockquote>`, {parse_mode: 'HTML'});
                        } else {
                            bot.sendMessage(chatId, `<blockquote>${e.error} Email masuk, tapi Link Verifikasi tidak ditemukan.</blockquote>`, {parse_mode: 'HTML'});
                        }
                    } else if (attempt >= 40) { // Timeout 120 detik
                        clearInterval(checker);
                        bot.sendMessage(chatId, `<blockquote>${e.warn} Waktu tunggu habis untuk <code>${emailAddr}</code>. Silakan buat ulang.</blockquote>`, {parse_mode: 'HTML'});
                    }
                } catch(err) {}
            }, 3000);
        } catch(err) {
            bot.editMessageText(`<blockquote>${e.error} Gagal membuat Tempmail API. Coba lagi nanti.</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }
    });

    // FITUR 2: INISIASI AMPREM (Tahap 1 - Meminta Link)
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

        // Menyimpan data email ke dalam antrean tunggu link
        ampremState.set(userId, { email, chatId });

        bot.sendMessage(chatId, `<blockquote><b>${e.loading} MENUNGGU MAGIC LINK</b>\n\n${e.block_mid} Target: <code>${email}</code>\n${e.block_end} Status: Menunggu kamu mengirimkan OOB Link...\n\n<i>Kirim link Alight Motion ke chat ini sekarang.\nKetik <code>/cancel</code> untuk membatalkan proses.</i></blockquote>`, {parse_mode: 'HTML'});
    });

    // FITUR 3: LISTENER MAGIC LINK (Tahap 2 - Mengeksekusi API)
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
                const link = linkMatch[0].replace(/&/g, '&');
                ampremState.delete(userId); 

                const COOLDOWN_TIME = 60000; 
                let db = readDB();
                const user = db[userId];
                
                if (ampremCooldowns.has(userId) && user.limit !== "UNLIMITED") {
                    const diff = Date.now() - ampremCooldowns.get(userId);
                    if (diff < COOLDOWN_TIME) {
                        const timeLeft = Math.ceil((COOLDOWN_TIME - diff) / 1000);
                        return bot.sendMessage(state.chatId, `<blockquote>${e.warn} <b>COOLDOWN AKTIF</b>\nTunggu <b>${timeLeft} detik</b> lagi sebelum membuat amprem!</blockquote>`, {parse_mode: 'HTML'});
                    }
                }

                const waitMsg = await bot.sendMessage(state.chatId, `<blockquote>${e.loading} <b>MEMPROSES AMPREM</b>\n\n${e.block_mid} Target: <code>${state.email}</code>\n${e.block_end} Status: Melewati verifikasi sistem (Bypass Recaptcha)...</blockquote>`, {parse_mode: 'HTML'});
                ampremCooldowns.set(userId, Date.now());

                const result = await alightMotionAxios(state.email, link);
                
                if (result.success) {
                    db = readDB(); 
                    if (db[userId].limit !== "UNLIMITED") {
                        db[userId].limit -= 1;
                        writeDB(db);
                    }
                    
                    let limitText = db[userId].limit === "UNLIMITED" ? "Unlimited" : `${db[userId].limit}/${settings.roleLimits[db[userId].role]}`;
                    
                    bot.editMessageText(`<blockquote><b>${e.succes} AMPREM BERHASIL DIBUAT!</b>\n\n${e.block_mid} Email: <code>${state.email}</code>\n${e.block_mid} Status: ${result.message}\n${e.block_end} Sisa Limit: <b>${limitText}</b></blockquote>`, {chat_id: state.chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                } else {
                    ampremCooldowns.delete(userId); 
                    bot.editMessageText(`<blockquote>${e.error} <b>GAGAL PROSES</b>\n\n${e.block_mid} Target: <code>${state.email}</code>\n${e.block_end} Detail: ${result.error}</blockquote>`, {chat_id: state.chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                }
            } else {
                bot.sendMessage(state.chatId, `<blockquote>${e.error} Itu bukan link verifikasi yang valid!\nSilakan kirim link Alight Motion atau ketik <code>/cancel</code>.</blockquote>`, {parse_mode: 'HTML'});
            }
        }
    });
};