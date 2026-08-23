const axios = require('axios');
const e = require('./emojis');

const HEADERS = {
    'Content-Type': 'application/json',
    'Application-Name': 'web',
    'Application-Version': '4.0.0',
    'X-CORS-Header': 'iaWg3pchvFx48fY',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createEmail() {
    try {
        const res = await axios.post('https://api.internal.temp-mail.io/api/v3/email/new', { min_name_length: 10, max_name_length: 10 }, { headers: HEADERS });
        return res.data;
    } catch { return null; }
}

async function checkInbox(email) {
    try {
        const res = await axios.get(`https://api.internal.temp-mail.io/api/v3/email/${email}/messages`, { headers: HEADERS });
        return res.data;
    } catch { return []; }
}

async function fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await axios({ url, ...options });
            return res;
        } catch (err) {
            if (err.response && err.response.status === 503) await delay(3000);
            else if (i === retries) throw err;
            else await delay(3000);
        }
    }
}

function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

module.exports = (bot) => {
    // Fitur Tempmail (Temp-mail.io)
    bot.onText(/^\/tempmail$/, async (msg) => {
        const chatId = msg.chat.id;
        let waitMsg = await bot.sendMessage(chatId, `<blockquote>${e.loading} Sedang membuat tempmail...</blockquote>`, {parse_mode: 'HTML'});
        
        try {
            const acc = await createEmail();
            if(!acc) return bot.editMessageText(`<blockquote>${e.error} Gagal membuat tempmail.</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});

            bot.editMessageText(`<blockquote><b>${e.succes} TEMPMAIL BERHASIL DIBUAT</b>\n\n${e.block_mid} Email: <code>${acc.email}</code>\n${e.block_end} Token: <code>${acc.token}</code>\n\n<i>⏳ Menunggu pesan masuk (Maks 1.5 Menit)...</i></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});

            let attempt = 0;
            let checker = setInterval(async () => {
                attempt++;
                const msgs = await checkInbox(acc.email);
                if (msgs.length > 0) {
                    clearInterval(checker);
                    const m = msgs[0];
                    const otpMatch = m.body_text.match(/\b\d{4,8}\b/);
                    let resTxt = `<blockquote><b>${e.chat} INBOX BARU MASUK!</b>\n\n${e.block_mid} Dari: ${m.from}\n${e.block_mid} Subjek: ${m.subject}\n${e.block_mid} OTP: <code>${otpMatch ? otpMatch[0] : '-'}</code>\n${e.block_end} Pesan:\n${m.body_text.substring(0, 300)}...</blockquote>`;
                    bot.sendMessage(chatId, resTxt, {parse_mode: 'HTML'});
                } else if (attempt >= 30) {
                    clearInterval(checker);
                    bot.sendMessage(chatId, `<blockquote>${e.warn} Inbox timeout untuk <code>${acc.email}</code>.</blockquote>`, {parse_mode: 'HTML'});
                }
            }, 3000);
        } catch(err) {
            bot.editMessageText(`<blockquote>${e.error} Error System Tempmail.</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }
    });

    // Fitur Auto AM Premium (Ryezenstore)
    bot.onText(/^\/amprem(?:\s+(\d+))?$/, async (msg, match) => {
        const chatId = msg.chat.id;
        const totalTarget = parseInt(match[1]) || 1;
        
        if (totalTarget > 5) return bot.sendMessage(chatId, `<blockquote>${e.warn} Maksimal pembuatan bulk adalah 5 akun per request untuk mencegah spam!</blockquote>`, {parse_mode: 'HTML'});
        
        let waitMsg = await bot.sendMessage(chatId, `<blockquote>${e.loading} <b>MEMULAI BULK GENERATOR (${totalTarget} AKUN)</b>\n\nMendaftarkan akun Ryezen...</blockquote>`, {parse_mode: 'HTML'});

        try {
            // 1. Auto Register Ryezen
            const randomUser = `ryezen_${generateRandomString(6)}`;
            const randomPass = `ryezen${generateRandomString(6)}`;
            
            await fetchWithRetry('https://www.ryezenstore.online/api/auth/register', { method: 'POST', data: { username: randomUser, password: randomPass }, headers: { 'Content-Type': 'application/json', 'User-Agent': HEADERS['User-Agent'] }});
            const loginRes = await fetchWithRetry('https://www.ryezenstore.online/api/auth/login', { method: 'POST', data: { username: randomUser, password: randomPass }, headers: { 'Content-Type': 'application/json', 'User-Agent': HEADERS['User-Agent'] }});
            
            const cookies = loginRes.headers['set-cookie'];
            if (!cookies) throw new Error("Gagal mendapatkan Session Cookie Ryezen");
            const sessionCookie = cookies[0].split(';')[0];

            let successCount = 0;
            let resultList = `<blockquote><b>${e.crown} HASIL GENERATE AM PREMIUM</b>\n\n`;

            for (let i = 0; i < totalTarget; i++) {
                bot.editMessageText(`<blockquote>${e.loading} <b>MEMPROSES AKUN (${i+1}/${totalTarget})</b>\n\nMembuat tempmail dan mengirim link...</blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
                
                try {
                    // Create Tempmail Vercel
                    const mailRes = await axios.get('https://creatett-seven.vercel.app/api/tempmail/create');
                    const emailAddr = mailRes.data.email;

                    // Send Link
                    await fetchWithRetry('https://www.ryezenstore.online/api/am/send-link', { method: 'POST', data: { email: emailAddr }, headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie, 'User-Agent': HEADERS['User-Agent'] }});
                    
                    // Polling
                    let magicLink = '';
                    for (let poll = 1; poll <= 15; poll++) {
                        await delay(5000);
                        const listRes = await axios.get(`https://creatett-seven.vercel.app/api/tempmail/inbox/${emailAddr}`);
                        const messages = listRes.data;
                        if (Array.isArray(messages) && messages.length > 0) {
                            for (const m of messages) {
                                const emailString = JSON.stringify(m).replace(/\\/g, '');
                                const linkMatch = emailString.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:alightcreative\.com|alight\.link|alightmotion\.com)\/[^\s"'>]*/);
                                if (linkMatch) {
                                    magicLink = linkMatch[0].replace(/&/g, '&');
                                    break;
                                }
                            }
                        }
                        if (magicLink) break;
                    }

                    if (!magicLink) throw new Error("Timeout inbox");

                    // Activate
                    await fetchWithRetry('https://www.ryezenstore.online/api/am/activate', { method: 'POST', data: { email: emailAddr, magicLink: magicLink }, headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie, 'User-Agent': HEADERS['User-Agent'] }});
                    
                    successCount++;
                    resultList += `${e.block_mid} <b>Akun ${i+1}:</b> <code>${emailAddr}</code>\n`;
                    
                } catch (err) {
                    resultList += `${e.block_mid} <b>Akun ${i+1}:</b> ${e.error} Gagal (${err.message})\n`;
                }
            }

            resultList += `\n${e.block_end} Total Sukses: <b>${successCount}/${totalTarget}</b>\n<i>*Silakan login AM pakai Email di atas, lalu cek inbox Vercel manual untuk OTP login.</i></blockquote>`;
            bot.editMessageText(resultList, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});

        } catch (err) {
            bot.editMessageText(`<blockquote>${e.error} <b>FATAL ERROR</b>\nGagal mendaftarkan akun di Ryezenstore.\nDetail: <code>${err.message}</code></blockquote>`, {chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }
    });
};