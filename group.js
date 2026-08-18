const settings = require('./settings');
const axios = require('axios');

module.exports = (bot) => {
    bot.on('message', async (msg) => {
        if (!msg.text || msg.chat.type === 'private') return;
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const text = msg.text.toLowerCase();
        
        const chatMember = await bot.getChatMember(chatId, userId).catch(() => null);
        if (!chatMember) return;
        
        const isAdmin = chatMember.status === 'administrator' || chatMember.status === 'creator' || userId === settings.ID_KYNO || userId === settings.ID_TEMAN;
        const linkRegex = /(http:\/\/|https:\/\/|www\.|t\.me\/)/i;

        if (!isAdmin && linkRegex.test(text)) {
            bot.deleteMessage(chatId, msg.message_id).catch(() => {});
            const warnMsg = await bot.sendMessage(chatId, `<blockquote><b>[!] PERINGATAN</b>\n<a href="tg://user?id=${userId}">${msg.from.first_name}</a>, kamu dilarang mengirim link!</blockquote>`, {parse_mode: 'HTML'});
            setTimeout(() => bot.deleteMessage(chatId, warnMsg.message_id).catch(() => {}), 5000);
        }
    });

    bot.onText(/\/(ban|kick)/, async (msg) => {
        const chatId = msg.chat.id;
        const senderId = msg.from.id.toString();
        const chatMember = await bot.getChatMember(chatId, senderId).catch(() => null);
        const isAdmin = chatMember && (chatMember.status === 'administrator' || chatMember.status === 'creator' || senderId === settings.ID_KYNO || senderId === settings.ID_TEMAN);
        
        if (!isAdmin || !msg.reply_to_message) return;
        bot.banChatMember(msg.chat.id, msg.reply_to_message.from.id).then(() => {
            bot.sendMessage(msg.chat.id, `<blockquote>[✓] Member dikeluarkan.</blockquote>`, {parse_mode: 'HTML'});
        }).catch(() => {});
    });

    bot.onText(/\/mute/, async (msg) => {
        const chatId = msg.chat.id;
        const senderId = msg.from.id.toString();
        const chatMember = await bot.getChatMember(chatId, senderId).catch(() => null);
        const isAdmin = chatMember && (chatMember.status === 'administrator' || chatMember.status === 'creator' || senderId === settings.ID_KYNO || senderId === settings.ID_TEMAN);
        
        if (!isAdmin || !msg.reply_to_message) return;
        bot.restrictChatMember(msg.chat.id, msg.reply_to_message.from.id, { can_send_messages: false }).then(() => {
            bot.sendMessage(msg.chat.id, `<blockquote>[✓] Member dibisukan.</blockquote>`, {parse_mode: 'HTML'});
        }).catch(() => {});
    });

    bot.onText(/\/unmute/, async (msg) => {
        const chatId = msg.chat.id;
        const senderId = msg.from.id.toString();
        const chatMember = await bot.getChatMember(chatId, senderId).catch(() => null);
        const isAdmin = chatMember && (chatMember.status === 'administrator' || chatMember.status === 'creator' || senderId === settings.ID_KYNO || senderId === settings.ID_TEMAN);
        
        if (!isAdmin || !msg.reply_to_message) return;
        bot.restrictChatMember(msg.chat.id, msg.reply_to_message.from.id, { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true }).then(() => {
            bot.sendMessage(msg.chat.id, `<blockquote>[✓] Suara dipulihkan.</blockquote>`, {parse_mode: 'HTML'});
        }).catch(() => {});
    });

    bot.onText(/\/tourl/, async (msg) => {
        if (!msg.reply_to_message || !msg.reply_to_message.photo) return bot.sendMessage(msg.chat.id, `<blockquote>[×] Reply sebuah foto!</blockquote>`, {parse_mode: 'HTML'});
        const fileId = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1].file_id;
        const fileLink = await bot.getFileLink(fileId);
        bot.sendMessage(msg.chat.id, `<blockquote><b>❖ UPLOAD BERHASIL</b>\nURL: <code>${fileLink}</code></blockquote>`, {parse_mode: 'HTML'});
    });

    bot.onText(/\/tiktok (.+)/, async (msg, match) => {
        const url = match[1];
        const waitMsg = await bot.sendMessage(msg.chat.id, `<blockquote>[⏳] Mendownload TikTok...</blockquote>`, {parse_mode: 'HTML'});
        try {
            const res = await axios.post('https://www.tikwm.com/api/', { url });
            await bot.sendVideo(msg.chat.id, res.data.data.play, { caption: `<blockquote>[✓] Download Selesai!</blockquote>`, parse_mode: 'HTML' });
            bot.deleteMessage(msg.chat.id, waitMsg.message_id);
        } catch(e) {
            bot.editMessageText(`<blockquote>[×] Gagal download.</blockquote>`, {chat_id: msg.chat.id, message_id: waitMsg.message_id, parse_mode: 'HTML'});
        }
    });
};