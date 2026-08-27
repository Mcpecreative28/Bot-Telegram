const axios = require('axios');
const settings = require('./settings');
const e = require('./emojis');

const checkAccess = (msg) => {
    const isOwner = msg.from.id.toString() === settings.ID_KYNO || msg.from.id.toString() === settings.ID_TEMAN;
    return isOwner || msg.chat.id.toString() === settings.GROUP_ID;
};

// ================= KONFIGURASI ENGINE =================
const HEADERS_DAPJI = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

const IRFAN_COOKIE = "session=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI4MjU3NDhiOWM3YjVkOGE1MzQ0YmNkOTRiMjE5ZmIzZSIsImVtYWlsIjoic2FuenZvbHRleEBnbWFpbC5jb20iLCJpYXQiOjE3ODc0NTU5NTcsImV4cCI6MTc4NzQ1Nzc1N30.irU5mSZMtnRPviGtgN84lwzCw0yfSBl14rdNelRb6KU; hu8935j4i9fq3hpuj9q39=true; s9ifs0idfjlwfie32dekl=0; dom3ic8zudi28v8lr6fgphwffqoz0j6c=49bf5972-bc03-4075-8a31-6e3809611ae0%3A1%3A1; sb_main_8f9c3b6727bcb73b78e7930bbd864cb6=1; dom3ic8zudi28v8lr6fgphwffqoz0j6c=01a02cad-791b-7e77-a484-6f17b8a58685; vrk4n8fqhwc3jzy7pbsmgt6dx5lha2u9=01a02cad-791b-7e77-a484-6f17b8a58685_2; sb_count_8f9c3b6727bcb73b78e7930bbd864cb6=4";

const HEADERS_IRFAN = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
    'Referer': 'https://amprem.irfanjawa.com/dashboard/generator',
    'Cookie': IRFAN_COOKIE,
    'Content-Type': 'application/json'
};

const ampremCooldowns = new Map();
const ampremState = new Map();
const COOLDOWN_TIME = 60000;

// Alat Penerjemah Error agar tidak [object Object]
function parseError(err) {
    if (err.response && err.response.data) {
        if (typeof err.response.data === 'object') {
            return err.response.data.message || err.response.data.msg || err.response.data.error || JSON.stringify(err.response.data);
        }
        return String(err.response.data);
    }
    return err.message;
}

// ENGINE 1: DAPJIMOTIONPRO
async function sendLinkDapji(email) {
    const { data } = await axios.post('https://dapjimotionpro.my.id/api/proxy-amprem', { action: 'send', email: email, password: 'rohancakep' }, { headers: HEADERS_DAPJI, timeout: 15000 });
    return data;
}
async function verifyLinkDapji(email, link) {
    const { data } = await axios.post('https://dapjimotionpro.my.id/api/proxy-amprem', { action: 'verify', email: email, link: link, password: 'rohancakep' }, { headers: HEADERS_DAPJI, timeout: 20000 });
    return data;
}

// ENGINE 2: IRFANJAWA
async function sendLinkIrfan(email) {
    const { data } = await axios.post('https://amprem.irfanjawa.com/api/auth/send-magic-link', { email }, { headers: HEADERS_IRFAN, timeout: 15000 });
    return data;
}
async function verifyLinkIrfan(email, link) {
    const { data } = await axios.post('https://amprem.irfanjawa.com/api/auth/verify-magic-link', { email, magicLink: link }, { headers: HEADERS_IRFAN, timeout: 20000 });
    return data;
}
// ======================================================

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

            bot.editMessageText(`<blockquote><b>${e.succes} TEMPMAIL SIAP DIGUNAKAN</b>\n\n${e.block_mid} Email: <code>${emailAddr}</code>\n${e.block_end} Status: ${e.loading} Memantau pesan masuk (Maks 2 Menit)\n\n<i>Ketik:</i>\n<code>/amprem ${emailAddr}</code>\n<i>sekarang juga untuk memulai proses aktivasi!</i></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});

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
            return bot.sendMessage(chatId, `<blockquote>${e.error} JANGAN MENGIRIM LINK DI SINI!\nGunakan: <code>/amprem email@domain.com</code>\nBot akan meminta link-nya di pesan berikutnya.</blockquote>`, {parse_mode: 'HTML'});
        }

        if (!inputArgs || !inputArgs.includes('@')) {
            return bot.sendMessage(chatId, `<blockquote>${e.error} Format salah!\nGunakan: <code>/amprem email@domain.com</code></blockquote>`, {parse_mode: 'HTML'});
        }

        const email = inputArgs.trim();

        if (user.limit !== "UNLIMITED" && user.limit <= 0) return bot.sendMessage(chatId, `<blockquote>${e.error} Limit harian kamu sudah habis!</blockquote>`, {parse_mode: 'HTML'});

        let waitMsg = await bot.sendMessage(chatId, `<blockquote>${e.loading} <b>MENYIAPKAN SESI AMPREM</b>\n\nMeminta server untuk mengirimkan Magic Link...</blockquote>`, {parse_mode: 'HTML'});

        let activeEngine = null;
        let errDapji = '';
        let errIrfan = '';

        // DUAL ENGINE FIRING LOGIC
        try {
            await sendLinkDapji(email);
            activeEngine = 'DAPJI';
        } catch (err1) {
            errDapji = parseError(err1);
            try {
                await sendLinkIrfan(email);
                activeEngine = 'IRFANJAWA';
            } catch (err2) {
                errIrfan = parseError(err2);
            }
        }

        if (!activeEngine) {
            return bot.editMessageText(`<blockquote>${e.error} <b>GAGAL MEMICU EMAIL</b>\nSemua Engine Pusat Error/Mati!\n\n${e.block_mid} E1 (Dapji): <code>${errDapji}</code>\n${e.block_end} E2 (Irfan): <code>${errIrfan}</code></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }

        // Simpan Sesi (Tunggu user mengirim link)
        ampremState.set(userId, { email, chatId, engine: activeEngine });

        bot.editMessageText(`<blockquote><b>${e.loading} MENUNGGU MAGIC LINK</b>\n\n${e.block_mid} Target: <code>${email}</code>\n${e.block_mid} Engine: <b>${activeEngine}</b>\n${e.block_end} Status: Link telah dikirim ke email tersebut!\n\n<i>Tunggu link-nya muncul dari tempmail, lalu salin dan kirimkan link tersebut ke chat ini.\nKetik <code>/cancel</code> untuk membatalkan proses.</i></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
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
                const link = linkMatch[0].replace(/&amp;/g, '&').replace(/&/g, '&');
                
                const userStateEmail = state.email;
                const activeEngine = state.engine;
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

                let isSuccess = false;
                let finalMsg = '';
                let finalErr = '';

                try {
                    let actRes;
                    if (activeEngine === 'DAPJI') {
                        actRes = await verifyLinkDapji(userStateEmail, link);
                    } else {
                        actRes = await verifyLinkIrfan(userStateEmail, link);
                    }

                    // Cek jika balasan sukses
                    if (actRes.status === true || actRes.success === true || (actRes.msg && actRes.msg.includes("berhasil")) || (actRes.message && actRes.message.includes("berhasil"))) {
                        isSuccess = true;
                        finalMsg = actRes.msg || actRes.message || "Berhasil Diterapkan!";
                    } else {
                        throw new Error(parseError({ response: { data: actRes } }));
                    }
                } catch (err) {
                    finalErr = parseError(err);
                }

                if (isSuccess) {
                    db = readDB(); 
                    if (db[userId].limit !== "UNLIMITED") {
                        db[userId].limit -= 1;
                        writeDB(db);
                    }
                    let limitText = db[userId].limit === "UNLIMITED" ? "Unlimited" : `${db[userId].limit}/${settings.roleLimits[db[userId].role]}`;
                    
                    bot.editMessageText(`<blockquote><b>${e.succes} AMPREM BERHASIL DIBUAT!</b>\n\n${e.block_mid} Email: <code>${userStateEmail}</code>\n${e.block_mid} Info: ${finalMsg}\n${e.block_end} Sisa Limit: <b>${limitText}</b></blockquote>`, {chat_id: state.chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                } else {
                    ampremCooldowns.delete(userId); 
                    bot.editMessageText(`<blockquote>${e.error} <b>GAGAL PROSES LISENSI</b>\n\n${e.block_mid} Target: <code>${userStateEmail}</code>\n${e.block_end} Detail: <code>${finalErr}</code></blockquote>`, {chat_id: state.chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                }
            } else {
                bot.sendMessage(state.chatId, `<blockquote>${e.error} Itu bukan link verifikasi yang valid!\nSilakan kirim link Alight Motion atau ketik <code>/cancel</code>.</blockquote>`, {parse_mode: 'HTML'});
            }
        }
    });
};