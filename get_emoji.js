const TelegramBot = require('node-telegram-bot-api');

// Masukkan token bot kamu di sini
const token = '8975651955:AAH_5Ump6UBdl2TDeJDHN3gMcmFuuG0tJGc'; 
const bot = new TelegramBot(token, {polling: true});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    if (msg.entities) {
        const customEmojis = msg.entities.filter(e => e.type === 'custom_emoji');
        
        if (customEmojis.length > 0) {
            let response = "<blockquote><b>[✓] PREMIUM EMOJI ID DITEMUKAN:</b>\n\n";
            
            customEmojis.forEach((e, index) => {
                response += `Emoji ke-${index + 1} ID: <code>${e.custom_emoji_id}</code>\n`;
            });
            
            response += "</blockquote>\n<i>Silakan salin ID di atas dan masukkan ke dalam tag &lt;tg-emoji&gt; di kodemu!</i>";
            
            bot.sendMessage(chatId, response, {parse_mode: 'HTML'});
        } else {
            bot.sendMessage(chatId, "❌ Pesan ini tidak mengandung Premium Emoji.");
        }
    } else {
        bot.sendMessage(chatId, "❌ Kirimkan pesan yang berisi Premium Emoji.");
    }
});

console.log("Menunggu kamu mengirimkan Premium Emoji...");