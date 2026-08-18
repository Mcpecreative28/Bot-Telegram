const settings = require('./settings');
const e = require('./emojis');

module.exports = (bot, readDB, writeDB) => {
    const getRoleAccessText = (userRole) => {
        let text = `<blockquote><b>${e.user} ROLE ACCESS</b>\n`;
        settings.roleHierarchy.forEach((r, idx) => {
            if(r === "USER") return;
            const mark = userRole === r || settings.roleHierarchy.indexOf(userRole) >= idx ? e.succes : e.error;
            const prefix = idx === settings.roleHierarchy.length - 1 ? e.block_end : e.block_mid;
            text += `${prefix} ${r}: ${mark}\n`;
        });
        return text + `</blockquote>`;
    };

    const getLimitText = (user) => {
        let totalLimit = settings.roleLimits[user.role];
        return totalLimit === "UNLIMITED" ? "Unlimited" : `${user.limit}/${totalLimit}`;
    };

    const getMainMenu = (user, usernameTg) => {
        const text = `<blockquote><b>${e.star} SELAMAT DATANG DI ALL TIER PANEL KR STORE!</b>\n${e.bullet} Halo, <b>${usernameTg}</b></blockquote>\n\n<blockquote><b>${e.chat} INFO USER</b>\n${e.block_mid} Username: ${usernameTg}\n${e.block_mid} User ID: <code>${user.id}</code>\n${e.block_mid} Role: ${user.role}\n${e.block_mid} Limit: <b>${getLimitText(user)}</b>\n${e.block_end} Status: ${e.active} Active</blockquote>\n\n${getRoleAccessText(user.role)}\n\n<blockquote><b>${e.fire} COMMAND CEPAT</b>\n${e.block_mid} /1gb nama - /10gb nama\n${e.block_end} /unli nama</blockquote>\n\n<i>Pilih menu di bawah untuk mulai.</i>`;

        let inlineKeyboard = [[{ text: '⎚ 𝗖𝗿𝗲𝗮𝘁𝗲 𝗠𝗲𝗻𝘂', callback_data: 'menu_create' }], [{ text: '⛨ 𝗚𝗿𝗼𝘂𝗽 𝗠𝗲𝗻𝘂', callback_data: 'menu_group' }]];
        if (settings.roleHierarchy.indexOf(user.role) >= settings.roleHierarchy.indexOf("CO-FOUNDER")) {
            inlineKeyboard.push([{ text: '⚜ 𝗢𝘄𝗻𝗲𝗿 𝗠𝗲𝗻𝘂', callback_data: 'menu_owner' }]);
        }
        return { text, inlineKeyboard };
    };

    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const usernameTg = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        
        let db = readDB();
        let assignedRole = "USER";
        if (userId === settings.ID_KYNO) assignedRole = "OWNER";
        else if (userId === settings.ID_TEMAN) assignedRole = "CO-FOUNDER";

        if (!db[userId]) {
            db[userId] = { id: userId, name: msg.from.first_name, role: assignedRole, limit: settings.roleLimits[assignedRole], hasStartedPM: (msg.chat.type === 'private'), warnings: 0, expiredAt: null };
        }
        if (msg.chat.type === 'private') db[userId].hasStartedPM = true; 
        writeDB(db);

        const menu = getMainMenu(db[userId], usernameTg);
        
        try {
            await bot.sendPhoto(chatId, settings.MENU_MEDIA, { caption: menu.text, parse_mode: 'HTML', reply_markup: { inline_keyboard: menu.inlineKeyboard } });
        } catch (error) {
            await bot.sendMessage(chatId, menu.text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: menu.inlineKeyboard } });
        }
    });

    bot.onText(/\/info/, (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        let db = readDB();
        const user = db[userId];

        if (!user) return bot.sendMessage(chatId, `<blockquote>${e.error} Data belum terdaftar. Ketik /start.</blockquote>`, {parse_mode: 'HTML'});

        let expText = "Permanen";
        if (user.expiredAt) {
            let diff = user.expiredAt - Date.now();
            if (diff > 0) {
                let d = Math.floor(diff / (1000 * 60 * 60 * 24));
                let h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                let m = Math.floor((diff / 1000 / 60) % 60);
                expText = `${d} Hari, ${h} Jam, ${m} Menit`;
            } else {
                expText = "Expired";
            }
        }

        const infoText = `<blockquote><b>${e.user} DATA USER</b>\n${e.block_mid} Nama: ${user.name}\n${e.block_mid} ID: <code>${userId}</code>\n${e.block_mid} Role: <b>${user.role}</b>\n${e.block_mid} Limit: <b>${getLimitText(user)}</b>\n${e.block_end} Expiry: ${expText}</blockquote>\n\n${getRoleAccessText(user.role)}\n\n<blockquote><b>${e.server} SERVER ACCESS</b>\n${e.block_mid} Server 1: ${e.succes}\n${e.block_end} Server 2: ${e.succes}</blockquote>\n\n<blockquote><b>${e.star} START BOT</b>\n${e.block_end} Status: ${user.hasStartedPM ? `${e.succes} Sudah` : `${e.error} Belum`}</blockquote>`;
        bot.sendMessage(chatId, infoText, {parse_mode: 'HTML'});
    });

    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        let db = readDB();
        const user = db[query.from.id.toString()];
        const usernameTg = query.from.username ? `@${query.from.username}` : query.from.first_name;

        if (!user) return;
        if (query.data === 'menu_back') {
            const menu = getMainMenu(user, usernameTg);
            if(query.message.caption) bot.editMessageCaption(menu.text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: { inline_keyboard: menu.inlineKeyboard } }).catch(()=>{});
            else bot.editMessageText(menu.text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: { inline_keyboard: menu.inlineKeyboard } }).catch(()=>{});
            return;
        }
        
        const editText = (text, kb) => {
            if(query.message.caption) bot.editMessageCaption(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(()=>{});
            else bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(()=>{});
        };

        if (query.data === 'menu_create') editText(`<blockquote><b>${e.cloud} CREATE MENU</b>\nKetik perintah di bawah ini:\n\n<code>/1gb username</code>\n<code>/2gb username</code>\n<code>/3gb username</code>\n<code>/4gb username</code>\n<code>/5gb username</code>\n<code>/unli username</code></blockquote>`, [[{ text: '❮ 𝗞𝗲𝗺𝗯𝗮𝗹𝗶', callback_data: 'menu_back' }]]);
        if (query.data === 'menu_group') editText(`<blockquote><b>${e.shield} GROUP MENU</b>\n<i>Hanya Admin/Owner:</i>\n<code>/ban</code> - Banned\n<code>/kick</code> - Kick\n<code>/mute</code> - Mute\n<code>/unmute</code> - Unmute\n\n<i>Member Area:</i>\n<code>/tourl</code> - Jadikan link (Reply foto)\n<code>/tiktok link</code> - Download TT\n<code>/cekidch</code> - Cek ID Grup/Channel</blockquote>`, [[{ text: '❮ 𝗞𝗲𝗺𝗯𝗮𝗹𝗶', callback_data: 'menu_back' }]]);
        if (query.data === 'menu_owner') editText(`<blockquote><b>${e.crown} OWNER MENU</b>\n\n<code>/addtier ID</code> - Tambah Role\n<code>/deltier ID</code> - Hapus Role\n<code>/listtier </code> - Menampilkan List Role\n<code>/listsrv</code> - Cek List Server\n<code>/listsrvoff</code> - Cek Server OFF\n<code>/delsrv ID</code> - Hapus Server\n<code>/delsrvoff</code> - Hapus Server OFF\n<code>/deluser ID</code> - Hapus User\n<code>/deluseroff</code> - Hapus User Kosong\n<code>/ping</code> - Cek Spek VPS\n<code>/autobackup on/off</code>\n<code>/autocpu on/off</code>\n<code>/getemoji on/off</code> - Scanner Emoji</blockquote>`, [[{ text: '❮ 𝗞𝗲𝗺𝗯𝗮𝗹𝗶', callback_data: 'menu_back' }]]);
    });
};