const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const axios = require('axios');
const settings = require('./settings');

const bot = new TelegramBot(settings.TOKEN, {polling: true});
const dbPath = './database/users.json';

if (!fs.existsSync('./database')) fs.mkdirSync('./database');

function readDB() {
    if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}
function writeDB(data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); }

require('./start')(bot, readDB, writeDB);
require('./create')(bot, readDB, writeDB);
require('./group')(bot);
require('./owner')(bot, readDB, writeDB);
require('./tools')(bot); // Load Fitur Tempmail & Amprem

const getActiveServers = () => {
    return [
        { d: settings.DOMAIN1, a: settings.PLTA1, c: settings.PLTC1, tag: 'S1' },
        { d: settings.DOMAIN2, a: settings.PLTA2, c: settings.PLTC2, tag: 'S2' },
        { d: settings.DOMAIN3, a: settings.PLTA3, c: settings.PLTC3, tag: 'S3' }
    ].filter(s => s.d && !s.d.includes('ISI_DOMAIN') && s.d.trim() !== '');
};

const formatUrl = (url) => url.startsWith('http') ? url : 'https://' + url;

cron.schedule('0 0 * * *', () => {
    let db = readDB();
    const now = Date.now();
    for (let userId in db) {
        if (userId === '_config') continue;
        const roleLevel = settings.roleHierarchy.indexOf(db[userId].role);
        const ownerLevel = settings.roleHierarchy.indexOf("CO-FOUNDER");
        
        if (roleLevel < ownerLevel && db[userId].expiredAt && now > db[userId].expiredAt) {
            db[userId].role = "USER";
            db[userId].expiredAt = null;
        }
        db[userId].limit = settings.roleLimits[db[userId].role]; 
    }
    writeDB(db);
}, { timezone: "Asia/Jakarta" });

cron.schedule('0 * * * *', () => {
    let db = readDB();
    let config = db['_config'] || { autobackup: false, backupGroup: settings.GROUP_ID };
    if (config.autobackup) {
        const now = Date.now();
        const backupPath = `./database/backup_${now}.json`;
        fs.copyFileSync(dbPath, backupPath);
        bot.sendDocument(config.backupGroup, backupPath, { 
            caption: `<blockquote><b>❖ AUTO BACKUP DATABASE</b>\n⊛ Waktu: ${new Date().toLocaleString('id-ID', {timeZone: 'Asia/Jakarta'})}\n⊛ Status: Berhasil disimpan.</blockquote>`, parse_mode: 'HTML' 
        }).catch(()=>{});
    }
}, { timezone: "Asia/Jakarta" });

cron.schedule('*/10 * * * *', async () => {
    let db = readDB();
    let config = db['_config'] || { autocpu: false };
    if (!config.autocpu) return;

    const activeServers = getActiveServers();
    for (let srvConfig of activeServers) {
        let domain = formatUrl(srvConfig.d);
        let plta = srvConfig.a;
        let pltc = srvConfig.c;
        let serverTag = srvConfig.tag;
        
        let loadingMsg;
        try {
            loadingMsg = await bot.sendMessage(settings.GROUP_ID, `<blockquote><b>[⏳] PENGECEKAN CPU - ${serverTag}</b>\nMemeriksa penggunaan CPU...</blockquote>`, {parse_mode: 'HTML'});
            let allServers = [];
            let currentPage = 1; let totalPages = 1;

            do {
                const res = await axios.get(`${domain}/api/application/servers?page=${currentPage}`, { headers: { 'Authorization': `Bearer ${plta}`, 'Accept': 'application/json' }});
                allServers = allServers.concat(res.data.data);
                totalPages = res.data.meta.pagination.total_pages;
                currentPage++;
            } while (currentPage <= totalPages);

            let totalChecked = 0;
            let killedServers = [];

            for (let srv of allServers) {
                try {
                    const usageRes = await axios.get(`${domain}/api/client/servers/${srv.attributes.identifier}/resources`, { headers: { 'Authorization': `Bearer ${pltc}`, 'Accept': 'application/json' }});
                    const cpuUsage = usageRes.data.attributes.resources.cpu_absolute;
                    totalChecked++;

                    if (cpuUsage > 80) { 
                        await axios.post(`${domain}/api/client/servers/${srv.attributes.identifier}/power`, { signal: "kill" }, { headers: { 'Authorization': `Bearer ${pltc}`, 'Accept': 'application/json' }});
                        await axios.post(`${domain}/api/application/servers/${srv.attributes.id}/suspend`, {}, { headers: { 'Authorization': `Bearer ${plta}`, 'Accept': 'application/json' }});
                        killedServers.push(`${srv.attributes.name} (${cpuUsage.toFixed(2)}%) [Suspended]`);
                    }
                } catch (e) { }
            }

            let resultText = `<blockquote><b>[✓] [AUTO-CHECK CPU] - ${serverTag}</b>\n\nTotal Dicek: ${totalChecked}\n\n`;
            if (killedServers.length > 0) {
                resultText += `<b>Tindakan (Kill/Suspend):</b>\n` + killedServers.map(s => `├ ${s}`).join('\n') + `\n\nServer yang tidak melanggar berada dalam batas wajar.`;
            } else {
                resultText += `Semua server dalam batas CPU wajar.`;
            }
            resultText += `</blockquote>`;
            await bot.editMessageText(resultText, { chat_id: settings.GROUP_ID, message_id: loadingMsg.message_id, parse_mode: 'HTML' });
        } catch (error) {
            let errText = `<blockquote><b>[×] [AUTO-CHECK GAGAL TOTAL] - ${serverTag}</b>\nGagal mengecek server. API/Node Offline.</blockquote>`;
            if (loadingMsg) bot.editMessageText(errText, { chat_id: settings.GROUP_ID, message_id: loadingMsg.message_id, parse_mode: 'HTML' }).catch(()=>{});
        }
    }
});