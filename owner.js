const settings = require('./settings');
const e = require('./emojis');
const os = require('os');
const axios = require('axios');
const moment = require('moment-timezone');

const timeBuilders = new Map();
const customInputState = new Map();

const formatUrl = (url) => url.startsWith('http') ? url : 'https://' + url;

const getActiveServers = () => {
    return [
        { d: settings.DOMAIN1, a: settings.PLTA1, c: settings.PLTC1, tag: 'S1' },
        { d: settings.DOMAIN2, a: settings.PLTA2, c: settings.PLTC2, tag: 'S2' },
        { d: settings.DOMAIN3, a: settings.PLTA3, c: settings.PLTC3, tag: 'S3' }
    ].filter(s => s.d && !s.d.includes('ISI_DOMAIN') && s.d.trim() !== '');
};

module.exports = (bot, readDB, writeDB) => {
    const isOwner = (id) => id === settings.ID_KYNO || id === settings.ID_TEMAN;

    bot.onText(/^\/cekidch(?:\s+.*)?$/, (msg) => {
        if (!isOwner(msg.from.id.toString())) return;
        let idToCheck = msg.chat.id;
        let typeToCheck = msg.chat.type;
        let titleToCheck = msg.chat.title || msg.chat.first_name || "Unknown";
        if (msg.forward_from_chat) {
            idToCheck = msg.forward_from_chat.id;
            typeToCheck = msg.forward_from_chat.type;
            titleToCheck = msg.forward_from_chat.title || "Unknown Channel";
        }
        bot.sendMessage(msg.chat.id, `<blockquote><b>${e.gear} INFORMASI ID DITEMUKAN</b>\n\n${e.block_mid} <b>Nama:</b> ${titleToCheck}\n${e.block_mid} <b>Tipe:</b> ${typeToCheck}\n${e.block_end} <b>ID Chat:</b> <code>${idToCheck}</code></blockquote>\n<i>*Jika me-forward pesan, ID yang muncul adalah ID asalnya.</i>`, {parse_mode: 'HTML'});
    });

    bot.onText(/^\/ping(?:\s+.*)?$/, async (msg) => {
        if (!isOwner(msg.from.id.toString())) return;
        const startPing = Date.now();
        const waitMsg = await bot.sendMessage(msg.chat.id, `<blockquote>${e.loading} <i>Memeriksa sistem...</i></blockquote>`, {parse_mode: 'HTML'});
        
        let pteroPing = 0;
        try {
            const pStart = Date.now();
            await axios.get(`${formatUrl(settings.DOMAIN1)}/api/client`, { headers: { 'Authorization': `Bearer ${settings.PLTC1}` }});
            pteroPing = Date.now() - pStart;
        } catch(err) {}

        const latency = Date.now() - startPing;
        const totalResp = latency + pteroPing;
        
        const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        const usedMem = (totalMem - freeMem).toFixed(2);
        const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
        
        const d = Math.floor(os.uptime() / (3600*24));
        const h = Math.floor(os.uptime() % (3600*24) / 3600);
        const m = Math.floor(os.uptime() % 3600 / 60);

        let cpuModelName = "Unknown CPU";
        const cpusData = os.cpus();
        if (cpusData && cpusData.length > 0 && cpusData[0].model && cpusData[0].model !== "undefined" && cpusData[0].model.trim() !== "") {
            cpuModelName = cpusData[0].model;
        } else if (settings.VPS_MODEL && settings.VPS_MODEL.trim() !== "") {
            cpuModelName = settings.VPS_MODEL;
        }

        const text = `<blockquote><b>${e.gear} SYSTEM STATUS MONITOR</b></blockquote>\n\n<blockquote><b>${e.server} NETWORK STATUS</b>\n${e.separator}\n📶 Ping Bot: ${latency} ms\n⏳ Ptero Ping: ${pteroPing} ms\n⚡ Total Resp: ${totalResp} ms\n📊 Quality: ${e.succes} GOOD</blockquote>\n\n<blockquote><b>${e.cloud} SERVER ENVIRONMENT</b>\n${e.separator}\n🖥️ OS: ${os.type()} ${os.release()}\n🚀 Uptime: ${d}d ${h}h ${m}m</blockquote>\n\n<blockquote><b>${e.gear} CPU PERFORMANCE</b>\n${e.separator}\n🔧 Model: ${cpuModelName}\n🧮 Cores: ${cpusData ? cpusData.length : 'Unknown'}\n🔥 Status: ${e.succes} LOW LOAD</blockquote>\n\n<blockquote><b>${e.chart} MEMORY USAGE</b>\n${e.separator}\n📥 Used: ${usedMem} GB\n📦 Total: ${totalMem} GB\n📉 Ratio: ${memPercent} %\n🧠 Status: ${e.succes} GOOD</blockquote>`;
        bot.editMessageText(text, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
    });

    bot.onText(/^\/listsrv(?:\s+.*)?$/, async (msg) => {
        if (!isOwner(msg.from.id.toString())) return;
        const waitMsg = await bot.sendMessage(msg.chat.id, `<blockquote>${e.loading} <i>Mengambil data server...</i></blockquote>`, {parse_mode: 'HTML'});
        try {
            let text = `<blockquote><b>${e.star} LIST ALL SERVER PANEL</b>\n\n`;
            for (let srvConfig of getActiveServers()) {
                let currentPage = 1; let totalPages = 1; let srvList = [];
                do {
                    const res = await axios.get(`${formatUrl(srvConfig.d)}/api/application/servers?page=${currentPage}`, { headers: { 'Authorization': `Bearer ${srvConfig.a}`, 'Accept': 'application/json' } });
                    srvList = srvList.concat(res.data.data);
                    totalPages = res.data.meta.pagination.total_pages;
                    currentPage++;
                } while (currentPage <= totalPages);
                
                text += `<b>${srvConfig.tag} (${srvList.length} Server)</b>\n`;
                srvList.forEach(s => { text += `${e.block_mid} ID: <code>${s.attributes.id}</code> | ${s.attributes.name}\n`; });
                text += `\n`;
            }
            text += `</blockquote>`;
            bot.editMessageText(text, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        } catch (err) { bot.editMessageText(`<blockquote>${e.error} Gagal mengambil list server.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'}); }
    });

    bot.onText(/^\/listsrvoff(?:\s+.*)?$/, async (msg) => {
        if (!isOwner(msg.from.id.toString())) return;
        const waitMsg = await bot.sendMessage(msg.chat.id, `<blockquote>${e.loading} <i>Mencari server suspended...</i></blockquote>`, {parse_mode: 'HTML'});
        try {
            let text = `<blockquote><b>${e.warn} LIST SERVER SUSPENDED</b>\n\n`;
            let totalOff = 0;
            for (let srvConfig of getActiveServers()) {
                let currentPage = 1; let totalPages = 1; let srvList = [];
                do {
                    const res = await axios.get(`${formatUrl(srvConfig.d)}/api/application/servers?page=${currentPage}`, { headers: { 'Authorization': `Bearer ${srvConfig.a}`, 'Accept': 'application/json' } });
                    srvList = srvList.concat(res.data.data);
                    totalPages = res.data.meta.pagination.total_pages;
                    currentPage++;
                } while (currentPage <= totalPages);
                
                let offServers = srvList.filter(s => s.attributes.suspended === true);
                totalOff += offServers.length;
                if (offServers.length > 0) {
                    text += `<b>${srvConfig.tag} (${offServers.length} Suspended)</b>\n`;
                    offServers.forEach(s => { text += `${e.block_mid} ID: <code>${s.attributes.id}</code> | ${s.attributes.name}\n`; });
                }
            }
            if (totalOff === 0) text += `${e.block_end} Tidak ada server yang offline/suspended.`;
            text += `</blockquote>`;
            bot.editMessageText(text, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        } catch (err) { bot.editMessageText(`<blockquote>${e.error} Gagal mengambil list server.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'}); }
    });

    bot.onText(/^\/delsrvoff(?:\s+.*)?$/, async (msg) => {
        if (!isOwner(msg.from.id.toString())) return;
        const waitMsg = await bot.sendMessage(msg.chat.id, `<blockquote>${e.loading} <i>Menghapus server suspended di semua node...</i></blockquote>`, {parse_mode: 'HTML'});
        try {
            let deletedCount = 0;
            for (let srvConfig of getActiveServers()) {
                let currentPage = 1; let totalPages = 1; let srvList = [];
                do {
                    const res = await axios.get(`${formatUrl(srvConfig.d)}/api/application/servers?page=${currentPage}`, { headers: { 'Authorization': `Bearer ${srvConfig.a}`, 'Accept': 'application/json' } });
                    srvList = srvList.concat(res.data.data);
                    totalPages = res.data.meta.pagination.total_pages;
                    currentPage++;
                } while (currentPage <= totalPages);
                
                let offServers = srvList.filter(s => s.attributes.suspended === true);
                for (let srv of offServers) {
                    try {
                        await axios.delete(`${formatUrl(srvConfig.d)}/api/application/servers/${srv.attributes.id}`, { headers: { 'Authorization': `Bearer ${srvConfig.a}`, 'Accept': 'application/json' } });
                        deletedCount++;
                    } catch(err) {}
                }
            }
            bot.editMessageText(`<blockquote><b>${e.warn} HAPUS SERVER OFFLINE</b>\n\n${e.succes} Berhasil menghapus total ${deletedCount} server offline dari seluruh panel.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        } catch (err) { bot.editMessageText(`<blockquote>${e.error} Gagal memproses penghapusan.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'}); }
    });

    bot.onText(/^\/deluseroff(?:\s+.*)?$/, async (msg) => {
        if (!isOwner(msg.from.id.toString())) return;
        const waitMsg = await bot.sendMessage(msg.chat.id, `<blockquote>${e.loading} <i>Menghapus user tanpa server...</i></blockquote>`, {parse_mode: 'HTML'});
        try {
            let deletedCount = 0;
            for (let srvConfig of getActiveServers()) {
                let currentPage = 1; let totalPages = 1; let userList = [];
                do {
                    const res = await axios.get(`${formatUrl(srvConfig.d)}/api/application/users?include=servers&page=${currentPage}`, { headers: { 'Authorization': `Bearer ${srvConfig.a}`, 'Accept': 'application/json' } });
                    userList = userList.concat(res.data.data);
                    totalPages = res.data.meta.pagination.total_pages;
                    currentPage++;
                } while (currentPage <= totalPages);
                
                let offUsers = userList.filter(u => !u.attributes.relationships.servers.data || u.attributes.relationships.servers.data.length === 0);
                offUsers = offUsers.filter(u => u.attributes.id !== 1);
                
                for (let usr of offUsers) {
                    try {
                        await axios.delete(`${formatUrl(srvConfig.d)}/api/application/users/${usr.attributes.id}`, { headers: { 'Authorization': `Bearer ${srvConfig.a}`, 'Accept': 'application/json' } });
                        deletedCount++;
                    } catch(err) {}
                }
            }
            bot.editMessageText(`<blockquote><b>${e.user} HAPUS USER KOSONG</b>\n\n${e.succes} Berhasil menghapus ${deletedCount} user yang tidak memiliki server di seluruh node.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        } catch (err) { bot.editMessageText(`<blockquote>${e.error} Gagal memproses penghapusan user.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'}); }
    });

    bot.onText(/^\/delsrv(?:\s+(.+))?$/, async (msg, match) => {
        if (!isOwner(msg.from.id.toString())) return;
        const srvId = match[1];
        if (!srvId || isNaN(srvId)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/delsrv ID_SERVER</code></blockquote>`, {parse_mode: 'HTML'});
        
        let deleted = false;
        for (let srvConfig of getActiveServers()) {
            try {
                await axios.delete(`${formatUrl(srvConfig.d)}/api/application/servers/${srvId}`, { headers: { 'Authorization': `Bearer ${srvConfig.a}`, 'Accept': 'application/json' } });
                deleted = true; break;
            } catch (err) {}
        }
        if (deleted) bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Server ID ${srvId} berhasil dihapus.</blockquote>`, {parse_mode: 'HTML'});
        else bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Gagal menemukan/menghapus Server ID ${srvId}.</blockquote>`, {parse_mode: 'HTML'});
    });

    bot.onText(/^\/suspend(?:\s+(.+))?$/, async (msg, match) => {
        if (!isOwner(msg.from.id.toString())) return;
        const srvId = match[1];
        if (!srvId || isNaN(srvId)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/suspend ID_SERVER</code></blockquote>`, {parse_mode: 'HTML'});
        
        let suspended = false;
        for (let srvConfig of getActiveServers()) {
            try {
                await axios.post(`${formatUrl(srvConfig.d)}/api/application/servers/${srvId}/suspend`, {}, { headers: { 'Authorization': `Bearer ${srvConfig.a}`, 'Accept': 'application/json' } });
                suspended = true; break;
            } catch (err) {}
        }
        if (suspended) bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Server ID ${srvId} berhasil disuspend.</blockquote>`, {parse_mode: 'HTML'});
        else bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Gagal mensuspend Server ID ${srvId}.</blockquote>`, {parse_mode: 'HTML'});
    });

    bot.onText(/^\/unsuspend(?:\s+(.+))?$/, async (msg, match) => {
        if (!isOwner(msg.from.id.toString())) return;
        const srvId = match[1];
        if (!srvId || isNaN(srvId)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/unsuspend ID_SERVER</code></blockquote>`, {parse_mode: 'HTML'});
        
        let unsuspended = false;
        for (let srvConfig of getActiveServers()) {
            try {
                await axios.post(`${formatUrl(srvConfig.d)}/api/application/servers/${srvId}/unsuspend`, {}, { headers: { 'Authorization': `Bearer ${srvConfig.a}`, 'Accept': 'application/json' } });
                unsuspended = true; break;
            } catch (err) {}
        }
        if (unsuspended) bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Server ID ${srvId} berhasil di-unsuspend.</blockquote>`, {parse_mode: 'HTML'});
        else bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Gagal unsuspend Server ID ${srvId}.</blockquote>`, {parse_mode: 'HTML'});
    });

    bot.onText(/^\/listtier$/, async (msg) => {
        if (!isOwner(msg.from.id.toString())) return;
        let db = readDB();
        let text = `<blockquote><b>${e.user} DAFTAR USER BER-TIER</b>\n\n`;
        let count = 0;

        for (let userId in db) {
            if (userId === '_config') continue;
            let user = db[userId];
            let roleIdx = settings.roleHierarchy.indexOf(user.role);
            if (roleIdx > 0 && roleIdx < settings.roleHierarchy.indexOf("CO-FOUNDER")) {
                let expText = "Permanen";
                if (user.expiredAt) {
                    let diff = user.expiredAt - Date.now();
                    if (diff > 0) {
                        let d = Math.floor(diff / (1000 * 60 * 60 * 24));
                        let h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                        expText = `${d} Hari, ${h} Jam`;
                    } else {
                        expText = "Expired";
                    }
                }
                text += `${e.block_mid} <b>${user.name}</b> (<code>${userId}</code>)\n   ${e.block_mid} Role: ${user.role}\n   ${e.block_end} Waktu: ${expText}\n\n`;
                count++;
            }
        }
        
        if(count === 0) text += `╰ Tidak ada user dengan role khusus.`;
        text += `</blockquote>`;
        bot.sendMessage(msg.chat.id, text, {parse_mode: 'HTML'});
    });

    bot.onText(/^\/autobackup(?:\s+(.+))?$/, (msg, match) => {
        if (!isOwner(msg.from.id.toString())) return;
        const param = match[1];
        if (param !== 'on' && param !== 'off') return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/autobackup on|off</code></blockquote>`, {parse_mode: 'HTML'});
        let db = readDB();
        if (!db['_config']) db['_config'] = {};
        db['_config'].autobackup = param === 'on';
        db['_config'].backupGroup = msg.chat.id; 
        writeDB(db);
        bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Auto Backup diset ke <b>${param.toUpperCase()}</b>.</blockquote>`, {parse_mode: 'HTML'});
    });

    bot.onText(/^\/autocpu(?:\s+(.+))?$/, (msg, match) => {
        if (!isOwner(msg.from.id.toString())) return;
        const param = match[1];
        if (param !== 'on' && param !== 'off') return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/autocpu on|off</code></blockquote>`, {parse_mode: 'HTML'});
        let db = readDB();
        if (!db['_config']) db['_config'] = {};
        db['_config'].autocpu = param === 'on';
        writeDB(db);
        bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Auto CPU Check diset ke <b>${param.toUpperCase()}</b>.</blockquote>`, {parse_mode: 'HTML'});
    });

    bot.onText(/^\/addtier(?:\s+(.+))?$/, (msg, match) => {
        if (!isOwner(msg.from.id.toString())) return;
        const targetId = match[1];
        if (!targetId || isNaN(targetId)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/addtier ID_TELEGRAM</code></blockquote>`, {parse_mode: 'HTML'});
        let dbFile = readDB();
        if (!dbFile[targetId]) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} User tidak ditemukan.</blockquote>`, {parse_mode: 'HTML'});
        
        let roleButtons = [];
        const senderIdx = settings.roleHierarchy.indexOf("OWNER");
        for (let i = 1; i < senderIdx; i++) { 
            roleButtons.push([{ text: `⨭ ${settings.roleHierarchy[i]}`, callback_data: `setrole_${targetId}_${settings.roleHierarchy[i]}` }]);
        }
        bot.sendMessage(msg.chat.id, `<blockquote><b>${e.user} ADD TIER</b>\nPilih role untuk ID <code>${targetId}</code>:</blockquote>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: roleButtons } });
    });

    bot.onText(/^\/deltier(?:\s+(.+))?$/, (msg, match) => {
        if (!isOwner(msg.from.id.toString())) return;
        const targetId = match[1];
        if (!targetId || isNaN(targetId)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/deltier ID_TELEGRAM</code></blockquote>`, {parse_mode: 'HTML'});
        let dbFile = readDB();
        if (!dbFile[targetId]) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} User tidak ditemukan.</blockquote>`, {parse_mode: 'HTML'});
        
        dbFile[targetId].role = "USER";
        dbFile[targetId].limit = settings.roleLimits["USER"];
        dbFile[targetId].expiredAt = null;
        writeDB(dbFile);
        bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Role ID <code>${targetId}</code> telah diturunkan menjadi USER.</blockquote>`, {parse_mode: 'HTML'});
    });

    bot.on('callback_query', (query) => {
        const data = query.data;
        const chatId = query.message.chat.id;
        const msgId = query.message.message_id.toString();
        let db = readDB();

        if (data.startsWith('setrole_')) {
            if (!isOwner(query.from.id.toString())) return;
            const parts = data.split('_'); 
            timeBuilders.set(msgId, { targetId: parts[1], role: parts[2], ms: 0, perm: false });
            updateTimeBuilder(bot, chatId, msgId);
        }

        if (data.startsWith('time_')) {
            if (!isOwner(query.from.id.toString())) return;
            const session = timeBuilders.get(msgId);
            if (!session) return;

            const action = data.split('_')[1];
            if (action === 'add') session.ms += parseInt(data.split('_')[2]);
            if (action === 'perm') session.perm = true;
            if (action === 'reset') { session.ms = 0; session.perm = false; }
            if (action === 'custom') {
                customInputState.set(query.from.id.toString(), msgId);
                return bot.sendMessage(chatId, `<blockquote><b>${e.gear} INPUT KUSTOM DURASI</b>\nKetik durasi (d=hari, h=jam, m=menit).\n\nContoh: <code>5d</code>, <code>12h</code>, <code>30m</code></blockquote>`, {parse_mode: 'HTML'});
            }
            
            if (action === 'done') {
                const targetUser = db[session.targetId];
                let newExpiry = null;
                if (!session.perm) {
                    if (targetUser.role === session.role && targetUser.expiredAt && targetUser.expiredAt > Date.now()) {
                        newExpiry = targetUser.expiredAt + session.ms;
                    } else {
                        newExpiry = Date.now() + session.ms;
                    }
                }

                targetUser.role = session.role;
                targetUser.limit = settings.roleLimits[session.role];
                targetUser.expiredAt = newExpiry;
                writeDB(db);
                timeBuilders.delete(msgId);
                return bot.editMessageText(`<blockquote>${e.succes} Berhasil memberikan role <b>${session.role}</b> kepada <code>${session.targetId}</code>.</blockquote>`, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' });
            }
            updateTimeBuilder(bot, chatId, msgId);
        }
    });

    bot.on('message', (msg) => {
        const userId = msg.from.id.toString();
        if (!msg.text || !customInputState.has(userId)) return;
        
        const msgId = customInputState.get(userId);
        const session = timeBuilders.get(msgId);
        if (session) {
            const input = msg.text.toLowerCase();
            let addedMs = 0;
            if (input.endsWith('d')) addedMs = parseInt(input.replace('d','')) * 86400000;
            else if (input.endsWith('h')) addedMs = parseInt(input.replace('h','')) * 3600000;
            else if (input.endsWith('m')) addedMs = parseInt(input.replace('m','')) * 60000;
            
            if (addedMs > 0) {
                session.ms += addedMs;
                bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Menambahkan waktu kustom.</blockquote>`, {parse_mode: 'HTML'}).then(m => setTimeout(() => bot.deleteMessage(msg.chat.id, m.message_id), 3000));
                updateTimeBuilder(bot, msg.chat.id, msgId);
            } else {
                bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah. Gunakan 5d, 12h, atau 30m.</blockquote>`, {parse_mode: 'HTML'});
            }
        }
        customInputState.delete(userId);
    });

    function updateTimeBuilder(bot, chatId, msgId) {
        const session = timeBuilders.get(msgId);
        let timeText = "Permanen";
        if (!session.perm) {
            let d = Math.floor(session.ms / (1000 * 60 * 60 * 24));
            let h = Math.floor((session.ms / (1000 * 60 * 60)) % 24);
            let m = Math.floor((session.ms / 1000 / 60) % 60);
            timeText = `${d} Hari, ${h} Jam, ${m} Menit`;
        }

        const text = `<blockquote><b>${e.gear} ATUR DURASI ROLE</b>\n${e.block_mid} Role: <b>${session.role}</b>\n${e.block_mid} Untuk: <code>${session.targetId}</code>\n${e.block_mid} Durasi:\n${e.block_end} <b>${timeText}</b></blockquote>`;
        const buttons = [
            [{ text: '＋𝟭 𝗛𝗮𝗿𝗶', callback_data: `time_add_86400000` }, { text: '＋𝟳 𝗛𝗮𝗿𝗶', callback_data: `time_add_604800000` }],
            [{ text: '＋𝟭 𝗝𝗮𝗺', callback_data: `time_add_3600000` }, { text: '＋𝟭𝟮 𝗝𝗮𝗺', callback_data: `time_add_43200000` }],
            [{ text: '⌨ 𝗞𝘂𝘀𝘁𝗼𝗺 𝗪𝗮𝗸𝘁𝘂', callback_data: `time_custom` }],
            [{ text: '♾ 𝗣𝗲𝗿𝗺𝗮𝗻𝗲𝗻', callback_data: `time_perm` }, { text: '⟲ 𝗥𝗲𝘀𝗲𝘁', callback_data: `time_reset` }],
            [{ text: '◈ 𝗞𝗢𝗡𝗙𝗜𝗥𝗠𝗔𝗦𝗜', callback_data: `time_done` }]
        ];
        bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons }});
    }
};