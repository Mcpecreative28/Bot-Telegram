const settings = require('./settings');
const e = require('./emojis');
const axios = require('axios');
const moment = require('moment-timezone');

const userSessions = new Map();

module.exports = (bot, readDB, writeDB) => {
    bot.onText(/^\/(1gb|2gb|3gb|4gb|5gb|6gb|7gb|8gb|9gb|10gb|unli)(?:\s+(.+))?/, async (msg, match) => {
        let db = readDB();
        if (db['_config'] && db['_config'].getEmojiMode) return bot.sendMessage(msg.chat.id, `<blockquote>${e.warn} <b>MAINTENANCE</b>\nSistem Pembuatan Panel sedang dimatikan sementara oleh Owner.</blockquote>`, {parse_mode: 'HTML'});

        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const user = db[userId];

        if (!user) return bot.sendMessage(chatId, `<blockquote>${e.error} Data belum terdaftar. Ketik /start.</blockquote>`, {parse_mode: 'HTML'});

        const command = match[1].toLowerCase();
        const panelUsername = match[2];

        if (!panelUsername) return bot.sendMessage(chatId, `<blockquote>${e.error} Format salah!\nGunakan: <code>/${command} username</code></blockquote>`, {parse_mode: 'HTML'});
        if (user.limit !== "UNLIMITED" && user.limit <= 0) return bot.sendMessage(chatId, `<blockquote>${e.error} Limit pembuatan panel kamu habis!</blockquote>`, {parse_mode: 'HTML'});

        const text = `<blockquote><b>${e.server} PILIH SERVER</b>\n${e.block_mid} Paket: <b>${command.toUpperCase()}</b>\n${e.block_end} User: ${panelUsername}</blockquote>`;
        const buttons = [[{ text: '⛁ 𝗦𝗲𝗿𝘃𝗲𝗿 𝟭', callback_data: `srv_1_${userId}` }, { text: '⛁ 𝗦𝗲𝗿𝘃𝗲𝗿 𝟮', callback_data: `srv_2_${userId}` }]];

        const sentMsg = await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons }});
        userSessions.set(sentMsg.message_id.toString(), { command, panelUsername, userName: msg.from.first_name, usernameTg: msg.from.username ? `@${msg.from.username}` : msg.from.first_name });
    });

    bot.on('callback_query', async (query) => {
        const data = query.data;
        const chatId = query.message.chat.id;
        const msgId = query.message.message_id.toString();
        const session = userSessions.get(msgId);

        if (data.startsWith('srv_') || data.startsWith('egg_')) {
            if (!session) return bot.answerCallbackQuery(query.id, { text: '❌ Sesi expired atau bot direstart!', show_alert: true });
        }

        if (data.startsWith('srv_')) {
            const ownerId = data.split('_')[2];
            if (query.from.id.toString() !== ownerId) return bot.answerCallbackQuery(query.id, { text: '❌ Akses ditolak!', show_alert: true });
            
            session.serverChoice = data.split('_')[1];
            const text = `<blockquote><b>${e.gear} PILIH EGG / SCRIPT</b>\n${e.block_end} Server: S${session.serverChoice}</blockquote>`;
            const buttons = [
                [{ text: '𝗡𝗼𝗱𝗲.𝗷𝘀', callback_data: `egg_nodejs_${ownerId}` }, { text: '𝗣𝘆𝘁𝗵𝗼𝗻', callback_data: `egg_python_${ownerId}` }],
                [{ text: '𝗡𝗼𝗱𝗲.𝗷𝘀 𝗩𝟮', callback_data: `egg_nodejs_v2_${ownerId}` }, { text: '𝗚𝗼𝗹𝗮𝗻𝗴', callback_data: `egg_golang_${ownerId}` }]
            ];
            return bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
        }

        if (data.startsWith('egg_')) {
            const parts = data.split('_');
            const ownerId = parts[parts.length - 1];
            if (query.from.id.toString() !== ownerId) return bot.answerCallbackQuery(query.id, { text: '❌ Akses ditolak!', show_alert: true });

            const eggKey = parts.slice(1, -1).join('_');
            const eggId = settings.EGGS[eggKey];
            
            userSessions.delete(msgId);
            
            let db = readDB();
            let user = db[ownerId];
            if (user.limit !== "UNLIMITED") { user.limit -= 1; writeDB(db); }

            let spekGB = session.command === 'unli' ? 0 : parseInt(session.command.replace('gb', ''));
            let ramMb = spekGB === 0 ? 0 : spekGB * 1024;
            let diskMb = spekGB === 0 ? 0 : spekGB * 1024;
            let cpuCore = spekGB === 0 ? 0 : spekGB * 100;
            let sizeName = spekGB === 0 ? "Unlimited (∞)" : `${spekGB} GB`;

            let envConfig = {};
            if (eggKey === 'nodejs' || eggKey === 'nodejs_v2') {
                envConfig = { name: eggKey === 'nodejs' ? "NodeJS" : "NodeJS V2", image: "ghcr.io/parkervcp/yolks:nodejs_23", startup: "if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == \"1\" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; if [[ ! -z ${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then vars=$(echo ${CUSTOM_ENVIRONMENT_VARIABLES} | tr \";\" \"\\n\"); for line in $vars; do export $line; done fi; /usr/local/bin/${CMD_RUN};", environment: { "STARTUP": "npm start", "P_SERVER_LOCATION": "id", "P_SERVER_ALLOCATION_LIMIT": 0, "USER_UPLOAD": "0", "AUTO_UPDATE": "0", "MAIN_FILE": "index.js", "CMD_RUN": "npm start" } };
            } else if (eggKey === 'python') {
                envConfig = { name: "Python", image: "ghcr.io/parkervcp/yolks:python_3.11", startup: "if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == \"1\" ]]; then git pull; fi; if [[ ! -z ${PY_PACKAGES} ]]; then pip install ${PY_PACKAGES}; fi; if [[ -f /home/container/requirements.txt ]]; then pip install -r requirements.txt; fi; /usr/local/bin/python /home/container/${PY_FILE}", environment: { "STARTUP": "python main.py", "P_SERVER_LOCATION": "id", "P_SERVER_ALLOCATION_LIMIT": 0, "USER_UPLOAD": "0", "AUTO_UPDATE": "0", "PY_FILE": "main.py", "PY_PACKAGES": "", "REQUIREMENTS_FILE": "requirements.txt", "REQUIREMENTS": "requirements.txt", "FILE_LIBRARY": "" } };
            } else if (eggKey === 'golang') {
                envConfig = { name: "Golang", image: "ghcr.io/parkervcp/yolks:golang_1.21", startup: "if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == \"1\" ]]; then git pull; fi; go mod tidy; go run ${MAIN_FILE}", environment: { "STARTUP": "go run main.go", "P_SERVER_LOCATION": "id", "P_SERVER_ALLOCATION_LIMIT": 0, "USER_UPLOAD": "0", "AUTO_UPDATE": "0", "MAIN_FILE": "main.go" } };
            }

            const loadingText = `<blockquote><b>${e.loading} MEMBUAT PANEL...</b>\n${e.block_mid} Server: S${session.serverChoice}\n${e.block_mid} Nama: ${session.panelUsername}\n${e.block_mid} Egg: ${envConfig.name}\n${e.block_end} <i>Deploying, mohon tunggu...</i></blockquote>`;
            await bot.editMessageText(loadingText, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' });

            let targetDomain = session.serverChoice === '1' ? settings.DOMAIN1 : settings.DOMAIN2;
            let targetPlta = session.serverChoice === '1' ? settings.PLTA1 : settings.PLTA2;
            let targetLoc = session.serverChoice === '1' ? settings.LOC1 : settings.LOC2;

            try {
                const pteroConfigApp = { headers: { 'Authorization': `Bearer ${targetPlta}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }};
                
                const pUsername = session.panelUsername.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 8) + Math.floor(Math.random() * 100);
                const pPassword = Math.random().toString(36).slice(-8) + "A1!";
                const email = `${pUsername}@buyer.zyrodevv`;

                const uReq = await axios.post(`${targetDomain}/api/application/users`, { "email": email, "username": pUsername, "first_name": session.userName, "last_name": "User", "password": pPassword }, pteroConfigApp);
                const pteroId = uReq.data.attributes.id; 

                const serverPayload = {
                    "name": `${session.userName} - ${sizeName} (${envConfig.name})`,
                    "user": pteroId, "egg": eggId,
                    "docker_image": envConfig.image, "startup": envConfig.startup,
                    "environment": envConfig.environment,
                    "limits": { "memory": ramMb, "swap": 0, "disk": diskMb, "io": 500, "cpu": cpuCore },
                    "feature_limits": { "databases": 1, "backups": 1, "allocations": 1 },
                    "deploy": { "locations": [targetLoc], "dedicated_ip": false, "port_range": [] }
                };

                const sReq = await axios.post(`${targetDomain}/api/application/servers`, serverPayload, pteroConfigApp);
                const serverId = sReq.data.attributes.id; 

                let limitText = user.limit === "UNLIMITED" ? "Unlimited" : `${user.limit}/${settings.roleLimits[user.role]}`;

                const notaGroup = `<b>${e.succes} PANEL BERHASIL DIBUAT</b>\n\n<blockquote><b>${e.tag} NOTA CREATE PANEL</b>\n${e.block_mid} Tanggal: ${moment().tz("Asia/Jakarta").format("DD MMMM YYYY")}\n${e.block_mid} Jenis: ${session.command.toUpperCase()}\n${e.block_mid} Egg: ${envConfig.name}\n${e.block_mid} Server: S${session.serverChoice}\n${e.block_mid} User: ${pUsername}\n${e.block_mid} ID Panel: ${serverId}\n${e.block_mid} Sisa Limit: <b>${limitText}</b>\n${e.block_end} Pembuat: <a href="tg://user?id=${ownerId}">${session.usernameTg}</a></blockquote>\n<i>Data login sudah dikirim ke user di atas.</i>`;

                const dataPM = `<b>${e.lock} SUKSES CREATED PANEL!</b>\n\n<blockquote><b>${e.user} DATA PANEL</b>\n${e.block_mid} Name: ${pUsername}\n${e.block_mid} Email: ${email}\n${e.block_mid} ID Panel: ${serverId}\n${e.block_mid} Server: S${session.serverChoice}\n${e.block_mid} Paket: ${session.command.toUpperCase()}\n${e.block_end} Egg: ${envConfig.name}</blockquote>\n\n<blockquote><b>${e.star} AKUN PANEL</b>\n${e.block_mid} Username: <code>${pUsername}</code>\n${e.block_mid} Password: <code>${pPassword}</code>\n${e.block_end} Login: <a href="${targetDomain}">${targetDomain}</a></blockquote>\n\n<blockquote><b>${e.warn} RULES PANEL</b>\n${e.block_mid} Sensor domain\n${e.block_mid} No DDOS / Share Free\n${e.block_end} Garansi sesuai ketentuan store</blockquote>`;

                const buttons = [[{ text: '⎘ 𝗦𝗮𝗹𝗶𝗻 𝗨𝘀𝗲𝗿𝗻𝗮𝗺𝗲', copy_text: { text: pUsername } }, { text: '⚿ 𝗦𝗮𝗹𝗶𝗻 𝗣𝗮𝘀𝘀𝘄𝗼𝗿𝗱', copy_text: { text: pPassword } }], [{ text: '⛨ 𝗟𝗼𝗴𝗶𝗻 𝗣𝗮𝗻𝗲𝗹', url: targetDomain }]];
                
                bot.editMessageText(notaGroup, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' });
                bot.sendMessage(ownerId, dataPM, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }).catch(()=>{});

            } catch (error) {
                let errDetail = "Cek API Key Pterodactyl.";
                if (error.response && error.response.data && error.response.data.errors) {
                    errDetail = JSON.stringify(error.response.data.errors[0].detail || error.response.data.errors[0].code);
                }
                bot.editMessageText(`<blockquote>${e.error} <b>S Y S T E M  E R R O R</b>\n\n<code>${errDetail}</code></blockquote>`, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' });
                if (user.limit !== "UNLIMITED") { user.limit += 1; writeDB(db); }
            }
        }
    });
};