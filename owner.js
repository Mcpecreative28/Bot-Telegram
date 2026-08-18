const settings = require('./settings');
const e = require('./emojis');
const os = require('os');
const axios = require('axios');
const moment = require('moment-timezone');

const timeBuilders = new Map();
const customInputState = new Map();

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

    bot.onText(/^\/getemoji(?:\s+(.*))?$/, (msg, match) => {
        if (!isOwner(msg.from.id.toString())) return;
        const param = match[1];
        if (param !== 'on' && param !== 'off') return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/getemoji on</code> atau <code>/getemoji off</code></blockquote>`, {parse_mode: 'HTML'});
        
        let db = readDB();
        if (!db['_config']) db['_config'] = {};
        db['_config'].getEmojiMode = param === 'on';
        writeDB(db);
        
        if (param === 'on') {
            bot.sendMessage(msg.chat.id, `<blockquote><b>${e.fire} GET EMOJI MODE: ON</b>\n\nSistem Create Panel User <b>DIMATIKAN SEMENTARA</b>.\nSilakan kirimkan Custom Emoji ke chat ini.\n\nKetik <code>/getemoji off</code> untuk mengembalikan bot.</blockquote>`, {parse_mode: 'HTML'});
        } else {
            bot.sendMessage(msg.chat.id, `<blockquote><b>${e.succes} GET EMOJI MODE: OFF</b>\n\nSistem Panel kembali berjalan normal!</blockquote>`, {parse_mode: 'HTML'});
        }
    });

    bot.on('message', (msg) => {
        let db = readDB();
        const config = db['_config'] || {};
        
        if (config.getEmojiMode && isOwner(msg.from.id.toString())) {
            if (msg.text && msg.text.startsWith('/')) return;

            if (msg.entities) {
                const customEmojis = msg.entities.filter(ent => ent.type === 'custom_emoji');
                if (customEmojis.length > 0) {
                    let response = `<blockquote><b>${e.succes} PREMIUM EMOJI ID DITEMUKAN:</b>\n\n`;
                    customEmojis.forEach((ent, index) => {
                        response += `${e.block_mid} Emoji ${index + 1}: <code>${ent.custom_emoji_id}</code>\n`;
                    });
                    response += `</blockquote>`;
                    bot.sendMessage(msg.chat.id, response, {parse_mode: 'HTML'});
                } else {
                    bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Pesan ini tidak mengandung Premium Emoji.</blockquote>`, {parse_mode: 'HTML'});
                }
            } else if(msg.text && !msg.text.startsWith('/')) {
                bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Kirimkan pesan yang berisi Premium Emoji.</blockquote>`, {parse_mode: 'HTML'});
            }
        }
    });

    bot.onText(/^\/ping(?:\s+.*)?$/, async (msg) => {
        if (!isOwner(msg.from.id.toString())) return;

        const startPing = Date.now();
        const waitMsg = await bot.sendMessage(msg.chat.id, `<blockquote>${e.loading} <i>Memeriksa sistem...</i></blockquote>`, {parse_mode: 'HTML'});
        
        let pteroPing = 0;
        try {
            const pStart = Date.now();
            await axios.get(`${settings.DOMAIN1}/api/client`, { headers: { 'Authorization': `Bearer ${settings.PLTC1}` }});
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
        let db = readDB(); if (db['_config'] && db['_config'].getEmojiMode) return;
        if (!isOwner(msg.from.id.toString())) return;
        const waitMsg = await bot.sendMessage(msg.chat.id, `<blockquote>${e.loading} <i>Mengambil data server...</i></blockquote>`, {parse_mode: 'HTML'});
        try {
            let allServers = [];
            let currentPage = 1;
            let totalPages = 1;

            do {
                const res = await axios.get(`${settings.DOMAIN1}/api/application/servers?page=${currentPage}`, { headers: { 'Authorization': `Bearer ${settings.PLTA1}`, 'Accept': 'application/json' } });
                allServers = allServers.concat(res.data.data);
                totalPages = res.data.meta.pagination.total_pages;
                currentPage++;
            } while (currentPage <= totalPages);

            let text = `<blockquote><b>${e.star} LIST SERVER PANEL (S1)</b>\n\n`;
            allServers.forEach(s => { text += `${e.block_mid} ID: <code>${s.attributes.id}</code> | ${s.attributes.name}\n`; });
            text += `${e.block_end} Total: ${allServers.length} Server</blockquote>`;
            bot.editMessageText(text, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        } catch (err) { bot.editMessageText(`<blockquote>${e.error} Gagal mengambil list server.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'}); }
    });

    bot.onText(/^\/listsrvoff(?:\s+.*)?$/, async (msg) => {
        let db = readDB(); if (db['_config'] && db['_config'].getEmojiMode) return;
        if (!isOwner(msg.from.id.toString())) return;
        const waitMsg = await bot.sendMessage(msg.chat.id, `<blockquote>${e.loading} <i>Mencari server suspended...</i></blockquote>`, {parse_mode: 'HTML'});
        try {
            let allServers = [];
            let currentPage = 1; let totalPages = 1;
            do {
                const res = await axios.get(`${settings.DOMAIN1}/api/application/servers?page=${currentPage}`, { headers: { 'Authorization': `Bearer ${settings.PLTA1}`, 'Accept': 'application/json' } });
                allServers = allServers.concat(res.data.data);
                totalPages = res.data.meta.pagination.total_pages;
                currentPage++;
            } while (currentPage <= totalPages);
            
            let offServers = allServers.filter(s => s.attributes.suspended === true);
            if (offServers.length === 0) return bot.editMessageText(`<blockquote><b>${e.warn} LIST SERVER SUSPENDED (S1)</b>\n\n${e.block_end} Tidak ada server yang suspended.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
            
            let text = `<blockquote><b>${e.warn} LIST SERVER SUSPENDED (S1)</b>\n\n`;
            offServers.forEach(s => { text += `${e.block_mid} ID: <code>${s.attributes.id}</code> | ${s.attributes.name}\n`; });
            text += `${e.block_end} Total: ${offServers.length} Server Tersuspend</blockquote>`;
            bot.editMessageText(text, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        } catch (err) { bot.editMessageText(`<blockquote>${e.error} Gagal mengambil list server.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'}); }
    });

    bot.onText(/^\/delsrvoff(?:\s+.*)?$/, async (msg) => {
        let db = readDB(); if (db['_config'] && db['_config'].getEmojiMode) return;
        if (!isOwner(msg.from.id.toString())) return;
        const waitMsg = await bot.sendMessage(msg.chat.id, `<blockquote>${e.loading} <i>Menghapus server suspended...</i></blockquote>`, {parse_mode: 'HTML'});
        try {
            let allServers = [];
            let currentPage = 1; let totalPages = 1;
            do {
                const res = await axios.get(`${settings.DOMAIN1}/api/application/servers?page=${currentPage}`, { headers: { 'Authorization': `Bearer ${settings.PLTA1}`, 'Accept': 'application/json' } });
                allServers = allServers.concat(res.data.data);
                totalPages = res.data.meta.pagination.total_pages;
                currentPage++;
            } while (currentPage <= totalPages);
            
            let offServers = allServers.filter(s => s.attributes.suspended === true);
            if (offServers.length === 0) return bot.editMessageText(`<blockquote>${e.succes} Tidak ada server suspended untuk dihapus.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
            
            let deletedCount = 0;
            for (let srv of offServers) {
                try {
                    await axios.delete(`${settings.DOMAIN1}/api/application/servers/${srv.attributes.id}`, { headers: { 'Authorization': `Bearer ${settings.PLTA1}`, 'Accept': 'application/json' } });
                    deletedCount++;
                } catch(err) {}
            }
            bot.editMessageText(`<blockquote><b>${e.warn} HAPUS SERVER SUSPENDED</b>\n\n${e.succes} Berhasil menghapus ${deletedCount}/${offServers.length} server yang tersuspend.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        } catch (err) { bot.editMessageText(`<blockquote>${e.error} Gagal memproses penghapusan server.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'}); }
    });

    bot.onText(/^\/deluseroff(?:\s+.*)?$/, async (msg) => {
        let db = readDB(); if (db['_config'] && db['_config'].getEmojiMode) return;
        if (!isOwner(msg.from.id.toString())) return;
        const waitMsg = await bot.sendMessage(msg.chat.id, `<blockquote>${e.loading} <i>Menghapus user tanpa server...</i></blockquote>`, {parse_mode: 'HTML'});
        try {
            let allUsers = [];
            let currentPage = 1; let totalPages = 1;
            do {
                const res = await axios.get(`${settings.DOMAIN1}/api/application/users?include=servers&page=${currentPage}`, { headers: { 'Authorization': `Bearer ${settings.PLTA1}`, 'Accept': 'application/json' } });
                allUsers = allUsers.concat(res.data.data);
                totalPages = res.data.meta.pagination.total_pages;
                currentPage++;
            } while (currentPage <= totalPages);
            
            let offUsers = allUsers.filter(u => !u.attributes.relationships.servers.data || u.attributes.relationships.servers.data.length === 0);
            offUsers = offUsers.filter(u => u.attributes.id !== 1);

            if (offUsers.length === 0) return bot.editMessageText(`<blockquote>${e.succes} Tidak ada user tanpa server.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
            
            let deletedCount = 0;
            for (let usr of offUsers) {
                try {
                    await axios.delete(`${settings.DOMAIN1}/api/application/users/${usr.attributes.id}`, { headers: { 'Authorization': `Bearer ${settings.PLTA1}`, 'Accept': 'application/json' } });
                    deletedCount++;
                } catch(err) {}
            }
            bot.editMessageText(`<blockquote><b>${e.user} HAPUS USER KOSONG</b>\n\n${e.succes} Berhasil menghapus ${deletedCount}/${offUsers.length} user yang tidak memiliki server.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        } catch (err) { bot.editMessageText(`<blockquote>${e.error} Gagal memproses penghapusan user.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'}); }
    });

    bot.onText(/^\/delsrv(?:\s+(.+))?$/, async (msg, match) => {
        let db = readDB(); if (db['_config'] && db['_config'].getEmojiMode) return;
        if (!isOwner(msg.from.id.toString())) return;
        const srvId = match[1];
        if (!srvId || isNaN(srvId)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/delsrv ID_SERVER</code></blockquote>`, {parse_mode: 'HTML'});
        try {
            await axios.delete(`${settings.DOMAIN1}/api/application/servers/${srvId}`, { headers: { 'Authorization': `Bearer ${settings.PLTA1}`, 'Accept': 'application/json' } });
            bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Server ID ${srvId} berhasil dihapus.</blockquote>`, {parse_mode: 'HTML'});
        } catch (err) { bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Gagal menghapus Server ID ${srvId}.</blockquote>`, {parse_mode: 'HTML'}); }
    });

    bot.onText(/^\/deluser(?:\s+(.+))?$/, async (msg, match) => {
        let db = readDB(); if (db['_config'] && db['_config'].getEmojiMode) return;
        if (!isOwner(msg.from.id.toString())) return;
        const uId = match[1];
        if (!uId || isNaN(uId)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/deluser ID_USER</code></blockquote>`, {parse_mode: 'HTML'});
        try {
            await axios.delete(`${settings.DOMAIN1}/api/application/users/${uId}`, { headers: { 'Authorization': `Bearer ${settings.PLTA1}`, 'Accept': 'application/json' } });
            bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} User ID ${uId} berhasil dihapus dari Pterodactyl.</blockquote>`, {parse_mode: 'HTML'});
        } catch (err) { bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Gagal menghapus User ID ${uId}.</blockquote>`, {parse_mode: 'HTML'}); }
    });

    bot.onText(/^\/autobackup(?:\s+(.+))?$/, (msg, match) => {
        let db = readDB(); if (db['_config'] && db['_config'].getEmojiMode) return;
        if (!isOwner(msg.from.id.toString())) return;
        const param = match[1];
        if (param !== 'on' && param !== 'off') return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/autobackup on|off</code></blockquote>`, {parse_mode: 'HTML'});
        if (!db['_config']) db['_config'] = {};
        db['_config'].autobackup = param === 'on';
        db['_config'].backupGroup = msg.chat.id; 
        writeDB(db);
        bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Auto Backup diset ke <b>${param.toUpperCase()}</b>.</blockquote>`, {parse_mode: 'HTML'});
    });

    bot.onText(/^\/autocpu(?:\s+(.+))?$/, (msg, match) => {
        let db = readDB(); if (db['_config'] && db['_config'].getEmojiMode) return;
        if (!isOwner(msg.from.id.toString())) return;
        const param = match[1];
        if (param !== 'on' && param !== 'off') return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/autocpu on|off</code></blockquote>`, {parse_mode: 'HTML'});
        if (!db['_config']) db['_config'] = {};
        db['_config'].autocpu = param === 'on';
        writeDB(db);
        bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Auto CPU Check diset ke <b>${param.toUpperCase()}</b>.</blockquote>`, {parse_mode: 'HTML'});
    });

    bot.onText(/^\/addtier(?:\s+(.+))?$/, (msg, match) => {
        let db = readDB(); if (db['_config'] && db['_config'].getEmojiMode) return;
        if (!isOwner(msg.from.id.toString())) return;
        const targetId = match[1];
        if (!targetId || isNaN(targetId)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/addtier ID_TELEGRAM</code></blockquote>`, {parse_mode: 'HTML'});
        let dbFile = readDB();
        if (!dbFile[targetId]) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} User tidak ditemukan.</blockquote>`, {parse_mode: 'HTML'});
        
        const targetRoleIdx = settings.roleHierarchy.indexOf(dbFile[targetId].role);
        const ownerIdx = settings.roleHierarchy.indexOf("CO-FOUNDER");
        if (targetRoleIdx >= ownerIdx) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Role tertinggi tidak bisa diubah!</blockquote>`, {parse_mode: 'HTML'});

        let roleButtons = [];
        const senderIdx = settings.roleHierarchy.indexOf("OWNER");
        
        for (let i = 1; i < senderIdx; i++) { 
            roleButtons.push([{ text: `⨭ ${settings.roleHierarchy[i]}`, callback_data: `setrole_${targetId}_${settings.roleHierarchy[i]}` }]);
        }
        bot.sendMessage(msg.chat.id, `<blockquote><b>${e.user} ADD TIER</b>\nPilih role untuk ID <code>${targetId}</code>:</blockquote>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: roleButtons } });
    });

    bot.onText(/^\/deltier(?:\s+(.+))?$/, (msg, match) => {
        let db = readDB(); if (db['_config'] && db['_config'].getEmojiMode) return;
        if (!isOwner(msg.from.id.toString())) return;
        const targetId = match[1];
        if (!targetId || isNaN(targetId)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/deltier ID_TELEGRAM</code></blockquote>`, {parse_mode: 'HTML'});
        let dbFile = readDB();
        if (!dbFile[targetId]) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} User tidak ditemukan.</blockquote>`, {parse_mode: 'HTML'});
        
        const targetRoleIdx = settings.roleHierarchy.indexOf(dbFile[targetId].role);
        const ownerIdx = settings.roleHierarchy.indexOf("CO-FOUNDER");
        if (targetRoleIdx >= ownerIdx) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Role tertinggi tidak bisa diturunkan!</blockquote>`, {parse_mode: 'HTML'});

        dbFile[targetId].role = "USER";
        dbFile[targetId].limit = settings.roleLimits["USER"];
        dbFile[targetId].expiredAt = null;
        writeDB(dbFile);
        bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Role ID <code>${targetId}</code> telah diturunkan menjadi USER.</blockquote>`, {parse_mode: 'HTML'});
    });
    
    // Fitur Baru: Suspend Server
    bot.onText(/^\/suspend(?:\s+(.+))?$/, async (msg, match) => {
        if (!isOwner(msg.from.id.toString())) return;
        const srvId = match[1];
        if (!srvId || isNaN(srvId)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/suspend ID_SERVER</code></blockquote>`, {parse_mode: 'HTML'});
        try {
            await axios.post(`${settings.DOMAIN1}/api/application/servers/${srvId}/suspend`, {}, { headers: { 'Authorization': `Bearer ${settings.PLTA1}`, 'Accept': 'application/json' } });
            bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Server ID ${srvId} berhasil disuspend.</blockquote>`, {parse_mode: 'HTML'});
        } catch (err) { bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Gagal mensuspend Server ID ${srvId}. Pastikan ID benar.</blockquote>`, {parse_mode: 'HTML'}); }
    });

    // Fitur Baru: Unsuspend Server
    bot.onText(/^\/unsuspend(?:\s+(.+))?$/, async (msg, match) => {
        if (!isOwner(msg.from.id.toString())) return;
        const srvId = match[1];
        if (!srvId || isNaN(srvId)) return bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Format salah!\nGunakan: <code>/unsuspend ID_SERVER</code></blockquote>`, {parse_mode: 'HTML'});
        try {
            await axios.post(`${settings.DOMAIN1}/api/application/servers/${srvId}/unsuspend`, {}, { headers: { 'Authorization': `Bearer ${settings.PLTA1}`, 'Accept': 'application/json' } });
            bot.sendMessage(msg.chat.id, `<blockquote>${e.succes} Server ID ${srvId} berhasil di-unsuspend.</blockquote>`, {parse_mode: 'HTML'});
        } catch (err) { bot.sendMessage(msg.chat.id, `<blockquote>${e.error} Gagal unsuspend Server ID ${srvId}. Pastikan ID benar.</blockquote>`, {parse_mode: 'HTML'}); }
    });

    // Fitur Baru: List Tier
    bot.onText(/^\/listtier$/, async (msg) => {
        if (!isOwner(msg.from.id.toString())) return;
        let db = readDB();
        let text = `<blockquote><b>${e.user} DAFTAR USER BER-TIER</b>\n\n`;
        let count = 0;

        for (let userId in db) {
            if (userId === '_config') continue;
            let user = db[userId];
            // Hanya tampilkan user dengan role di atas USER, namun di bawah CO-FOUNDER (agar tidak terlalu penuh dengan admin)
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

    bot.on('callback_query', (query) => {
        const data = query.data;
        const chatId = query.message.chat.id;
        const msgId = query.message.message_id.toString();
        let db = readDB();

        if (data.startsWith('setrole_')) {
            if (!isOwner(query.from.id.toString())) return bot.answerCallbackQuery(query.id, { text: 'Akses Ditolak!', show_alert: true });
            const parts = data.split('_'); 
            timeBuilders.set(msgId, { targetId: parts[1], role: parts[2], ms: 0, perm: false });
            updateTimeBuilder(bot, chatId, msgId);
        }

        if (data.startsWith('time_')) {
            if (!isOwner(query.from.id.toString())) return bot.answerCallbackQuery(query.id, { text: 'Akses Ditolak!', show_alert: true });
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