const axios = require('axios');
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
const ampremState = new Map(); // Menyimpan { email, chatId, cookie }
const COOLDOWN_TIME = 60000;

function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

// FUNGSI MEMBUAT AKUN RYEZEN BARU (GRATIS KREDIT)
async function getRyezenSession() {
    const user = `kn_${generateRandomString(6)}`;
    const pass = `pws${generateRandomString(8)}`;
    try {
        await axios.post('https://www.ryezenstore.online/api/auth/register', { username: user, password: pass }, { headers: HEADERS, timeout: 10000 });
        const loginRes = await axios.post('https://www.ryezenstore.online/api/auth/login', { username: user, password: pass }, { headers: HEADERS, timeout: 10000 });

        const cookies = loginRes.headers['set-cookie'];
        if (cookies && cookies.length > 0) {
            return cookies.map(c => c.split(';')[0]).join('; ');
        }
        return null;
    } catch (err) {
        return null;
    }
}

module.exports = (bot, readDB, writeDB) => {
    // FITUR 1: TEMPMAIL
    bot.onText(/^\/tempmail$/, async (msg) => {
        if (!checkAccess(msg)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Akses ditolak. Command ini hanya di Grup Utama.</blockquote>`, {parse_mode: 'HTML'});

        const chatId = msg.chat.id;
        let waitMsg = await bot.sendMessage(chatId, `<blockquote>${e.loading} <b>MEMBUAT TEMPMAIL</b>\nSedang menyiapkan email...</blockquote>`, {parse_mode: 'HTML'});
        
        try {
            const mailRes = await axios.get('https://creatett-seven.vercel.app/api/tempmail/create');
            const emailAddr = mailRes.data.email;
            if(!emailAddr) throw new Error("API tidak mengembalikan email valid");

            bot.editMessageText(`<blockquote><b>${e.succes} TEMPMAIL SIAP DIGUNAKAN</b>\n\n${e.block_mid} Email: <code>${emailAddr}</code>\n${e.block_end} Status: ${e.loading} Memantau pesan masuk (Maks 2 Menit)\n\n<i>Ketik:</i>\n<code>/amprem ${emailAddr}</code>\n<i>untuk memicu pengiriman link secara otomatis!</i></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});

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
                            bot.sendMessage(chatId, `<blockquote><b>${e.chat} LINK OOB DITEMUKAN!</b>\n\n${e.block_mid} Email: <code>${emailAddr}</code>\n${e.block_end} Link:\n<code>${magicLink}</code>\n\n<i>Silakan salin link di atas dan tempel di chat ini untuk menyelesaikan proses Amprem!</i></blockquote>`, {parse_mode: 'HTML'});
                        } else {
                            bot.sendMessage(chatId, `<blockquote>${e.error} Email masuk, tapi Link Verifikasi tidak ditemukan.</blockquote>`, {parse_mode: 'HTML'});
                        }
                    } else if (attempt >= 40) { 
                        clearInterval(checker);
                        bot.sendMessage(chatId, `<blockquote>${e.warn} Pemantauan dihentikan untuk <code>${emailAddr}</code>.</blockquote>`, {parse_mode: 'HTML'});
                    }
                } catch(err) {}
            }, 3000);
        } catch(err) {
            bot.editMessageText(`<blockquote>${e.error} Gagal membuat Tempmail API. Coba lagi nanti.</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }
    });

    // FITUR 2: INISIASI AMPREM (Tahap 1 - Memicu Link & Menunggu)
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

        let waitMsg = await bot.sendMessage(chatId, `<blockquote>${e.loading} <b>MENYIAPKAN SESI AMPREM</b>\n\nSedang mendaftarkan akun di server pusat...</blockquote>`, {parse_mode: 'HTML'});

        // 1. Dapatkan Sesi Ryezen
        const sessionCookie = await getRyezenSession();
        if (!sessionCookie) {
            return bot.editMessageText(`<blockquote>${e.error} <b>GAGAL</b>\nServer Ryezen sedang sibuk. Silakan coba lagi nanti.</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }

        // 2. Suruh Ryezen Kirim Link ke Email
        try {
            await axios.post('https://www.ryezenstore.online/api/am/send-link', { email }, {
                headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie, 'User-Agent': HEADERS['User-Agent'] },
                timeout: 15000
            });
        } catch (err) {
            return bot.editMessageText(`<blockquote>${e.error} <b>GAGAL MEMICU EMAIL</b>\nServer menolak pengiriman link. Pastikan email valid dan belum terdaftar premium.</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }

        // 3. Simpan Sesi ke State
        ampremState.set(userId, { email, chatId, cookie: sessionCookie });

        bot.editMessageText(`<blockquote><b>${e.loading} MENUNGGU MAGIC LINK</b>\n\n${e.block_mid} Target: <code>${email}</code>\n${e.block_end} Status: Link Verifikasi telah dikirim otomatis ke email tersebut!\n\n<i>Tunggu link-nya muncul di atas, lalu salin dan kirimkan link tersebut ke chat ini.\nKetik <code>/cancel</code> untuk membatalkan proses.</i></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
    });

    // FITUR 3: LISTENER MAGIC LINK (Tahap 2 - Mengeksekusi API via Ryezen)
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
                
                // Ambil data state dan hapus agar tidak double-hit
                const userStateCookie = state.cookie;
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

                const waitMsg = await bot.sendMessage(state.chatId, `<blockquote>${e.loading} <b>MEMPROSES AKTIVASI LISENSI</b>\n\n${e.block_mid} Target: <code>${userStateEmail}</code>\n${e.block_end} Status: Menerapkan lisensi premium ke akun...</blockquote>`, {parse_mode: 'HTML'});
                ampremCooldowns.set(userId, Date.now());

                try {
                    // Eksekusi Activate menggunakan Cookie yang sama saat send-link
                    const actRes = await axios.post('https://www.ryezenstore.online/api/am/activate', {
                        email: userStateEmail, magicLink: link
                    }, {
                        headers: { 'Content-Type': 'application/json', 'Cookie': userStateCookie, 'User-Agent': HEADERS['User-Agent'] },
                        timeout: 20000
                    });

                    // Jika sukses
                    db = readDB(); 
                    if (db[userId].limit !== "UNLIMITED") {
                        db[userId].limit -= 1;
                        writeDB(db);
                    }
                    let limitText = db[userId].limit === "UNLIMITED" ? "Unlimited" : `${db[userId].limit}/${settings.roleLimits[db[userId].role]}`;
                    
                    bot.editMessageText(`<blockquote><b>${e.succes} AMPREM BERHASIL DIBUAT!</b>\n\n${e.block_mid} Email: <code>${userStateEmail}</code>\n${e.block_mid} Info: ${actRes.data.message || 'Lisensi Berhasil Ditambahkan!'}\n${e.block_end} Sisa Limit: <b>${limitText}</b></blockquote>`, {chat_id: state.chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});

                } catch (err) {
                    ampremCooldowns.delete(userId); 
                    bot.editMessageText(`<blockquote>${e.error} <b>GAGAL PROSES LISENSI</b>\n\n${e.block_mid} Target: <code>${userStateEmail}</code>\n${e.block_end} Detail: ${err.response?.data?.error || err.response?.data?.message || err.message}</blockquote>`, {chat_id: state.chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                }
            } else {
                bot.sendMessage(state.chatId, `<blockquote>${e.error} Itu bukan link verifikasi yang valid!\nSilakan kirim link Alight Motion atau ketik <code>/cancel</code>.</blockquote>`, {parse_mode: 'HTML'});
            }
        }
    });
};