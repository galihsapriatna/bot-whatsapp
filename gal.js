const { OpenAIApi, Configuration } = require("openai");
const fetch = require("node-fetch");

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

module.exports = async (gal, m, getPrefix, setPrefix) => {
    const msg = m.messages?.[0];
    if (!msg?.message) return;

    const sender = msg.key.remoteJid;
    const isGroup = sender.endsWith("@g.us");
    const pushname = msg.pushName || "Gal";

    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    let prefix = getPrefix();

    if (!body.startsWith(prefix)) return;

    const args = body.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    let isAdmin = false;
    let groupAdmins = [];
    if (isGroup) {
        const metadata = await gal.groupMetadata(sender);
        groupAdmins = metadata.participants.filter(p => p.admin).map(p => p.id);
        isAdmin = groupAdmins.includes(msg.key.participant || "");
    } else isAdmin = true;

    switch(command) {

        // ==== BASIC COMMANDS ====
        case "halo":
            await gal.sendMessage(sender, { text: `Halo juga, ${pushname}! 👋` });
            break;

        case "ping":
            await gal.sendMessage(sender, { text: "Pong! 🏓" });
            break;

        case "info":
        case "botinfo":
            await gal.sendMessage(sender, { text: "🤖 GalBot v3.3\nDeveloper: Kamu\nPrefix: " + prefix });
            break;

        case "bantuan":
        case "help":
            await gal.sendMessage(sender, { text:
`📜 Daftar Command GalBot:

Basic:
.halo, .ping, .info, .bantuan

Admin:
.kick, .ban, .promote, .demote, .mute, .unmute, .setgroupname, .setgrouppic

ChatGPT:
.chatgpt [pertanyaan]

Game:
.game batu/kertas/gunting
.game angka [1-5]

Fun:
.quote
.joke
.fakta
.meme

Utilities:
.sticker
.shortlink [url]
.cek [nomor]

Broadcast:
.broadcast [pesan] (Admin only)
`});
            break;

        // ==== CHATGPT ====
        case "chatgpt":
            if (!args.length) return gal.sendMessage(sender, { text: "❌ Silakan tulis pertanyaan" });
            try {
                const response = await openai.createChatCompletion({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: args.join(" ") }]
                });
                await gal.sendMessage(sender, { text: response.data.choices[0].message.content });
            } catch {
                await gal.sendMessage(sender, { text: "❌ Gagal terhubung ke ChatGPT" });
            }
            break;

        // ==== GAME ====
        case "game":
            if (!args[0]) return gal.sendMessage(sender, { text: "Gunakan: .game batu/kertas/gunting atau .game angka [1-5]" });
            if (["batu","kertas","gunting"].includes(args[0].toLowerCase())) {
                const choices = ["batu","kertas","gunting"];
                const userChoice = args[0].toLowerCase();
                const botChoice = choices[Math.floor(Math.random()*3)];
                let result = "Seri 🤝";
                if ((userChoice==="batu"&&botChoice==="gunting")||
                    (userChoice==="gunting"&&botChoice==="kertas")||
                    (userChoice==="kertas"&&botChoice==="batu")) result = "Kamu Menang 🎉";
                else if(userChoice!==botChoice) result = "Bot Menang 😎";
                await gal.sendMessage(sender, { text: `Kamu: ${userChoice}\nBot: ${botChoice}\nHasil: ${result}` });
            } else if (args[0].toLowerCase() === "angka") {
                const guess = parseInt(args[1]);
                if (isNaN(guess)||guess<1||guess>5) return gal.sendMessage(sender,{text:"❌ Masukkan angka 1-5"});
                const botNum = Math.floor(Math.random()*5)+1;
                let result = guess===botNum?"Kamu Menang 🎉":`Bot Menang 😎 (Bot: ${botNum})`;
                await gal.sendMessage(sender,{text:result});
            }
            break;

        // ==== ADMIN COMMANDS ====
        case "kick":
        case "ban":
        case "promote":
        case "demote":
        case "mute":
        case "unmute":
        case "setgroupname":
        case "setgrouppic":
            if (!isGroup) return gal.sendMessage(sender, { text: "❌ Hanya bisa digunakan di grup" });
            if (!isAdmin) return gal.sendMessage(sender, { text: "❌ Hanya admin yang bisa menggunakan command ini" });
            if (["kick","ban","promote","demote","mute","unmute"].includes(command)) {
                if (!msg.message.extendedTextMessage?.contextInfo?.mentionedJid) return gal.sendMessage(sender, { text: "❌ Mention user" });
                const actionMap = { kick:"remove", ban:"remove", promote:"promote", demote:"demote", mute:"mute", unmute:"unmute" };
                const action = actionMap[command];
                try {
                    for(const jid of msg.message.extendedTextMessage.contextInfo.mentionedJid){
                        await gal.groupParticipantsUpdate(sender,[jid],action);
                    }
                    await gal.sendMessage(sender,{text:`✅ User berhasil ${command}`});
                } catch {
                    await gal.sendMessage(sender,{text:`❌ Gagal ${command}`});
                }
            } else if(command==="setgroupname") {
                if(!args[0]) return gal.sendMessage(sender,{text:"❌ Masukkan nama group baru"});
                await gal.groupUpdateSubject(sender,args.join(" "));
                await gal.sendMessage(sender,{text:`✅ Nama grup diubah menjadi: ${args.join(" ")}`});
            } else if(command==="setgrouppic") {
                if(!msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) return gal.sendMessage(sender,{text:"❌ Reply ke gambar untuk set group pic"});
                const image = await gal.downloadMedia(msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage);
                await gal.updateProfilePicture(sender,image);
                await gal.sendMessage(sender,{text:"✅ Foto grup berhasil diubah"});
            }
            break;

        // ==== FUN COMMANDS ====
        case "quote":
            await gal.sendMessage(sender,{text:"“Jangan menyerah, terus belajar!”"});
            break;
        case "joke":
            await gal.sendMessage(sender,{text:"Kenapa programmer selalu bingung? Karena dia terus debugging 😅"});
            break;
        case "fakta":
            try {
                const res = await fetch("https://some-random-api.ml/facts");
                const data = await res.json();
                await gal.sendMessage(sender,{text:data.fact||"Tidak ada fakta saat ini"});
            } catch {
                await gal.sendMessage(sender,{text:"❌ Gagal mengambil fakta"});
            }
            break;
        case "meme":
            try {
                const res = await fetch("https://some-random-api.ml/meme");
                const data = await res.json();
                await gal.sendMessage(sender,{image:{url:data.image}});
            } catch {
                await gal.sendMessage(sender,{text:"❌ Gagal mengambil meme"});
            }
            break;

        // ==== UTILITIES ====
        case "sticker":
            if(!msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage)
                return gal.sendMessage(sender,{text:"❌ Reply ke gambar untuk jadi sticker"});
            const img = await gal.downloadMedia(msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage);
            await gal.sendMessage(sender,{sticker:img});
            break;
        case "shortlink":
            if(!args[0]) return gal.sendMessage(sender,{text:"❌ Masukkan URL"});
            await gal.sendMessage(sender,{text:`Shortlink: https://tinyurl.com/api-create.php?url=${encodeURIComponent(args[0])}`});
            break;
        case "cek":
            if(!args[0]) return gal.sendMessage(sender,{text:"❌ Masukkan nomor"});
            await gal.sendMessage(sender,{text:`Nomor dicek: ${args[0]}`});
            break;

        // ==== BROADCAST ====
        case "broadcast":
            if (!isAdmin) return gal.sendMessage(sender,{text:"❌ Hanya admin yang bisa broadcast"});
            if (!args.length) return gal.sendMessage(sender,{text:"❌ Masukkan pesan broadcast"});
            const chats = await gal.chats.all();
            let success=0, failed=0;
            for(const chat of chats){
                if(chat.id.endsWith("@g.us")){
                    try { await gal.sendMessage(chat.id,{text:args.join(" ")}); success++; } 
                    catch { failed++; }
                }
            }
            await gal.sendMessage(sender,{text:`✅ Broadcast selesai\nSukses: ${success}\nGagal: ${failed}`});
            break;

        default:
            await gal.sendMessage(sender, { text: "Perintah tidak dikenali ❌" });
            break;
    }
};
