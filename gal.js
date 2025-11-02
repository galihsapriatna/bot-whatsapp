const axios = require("axios");

module.exports = async (sock, m) => {
    const msg = m.messages[0];
    if (!msg.message) return;

    const sender = msg.key.remoteJid;
    const isGroup = sender.endsWith("@g.us");
    const pushname = msg.pushName || "User";

    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const prefix = ".";

    if (!body.startsWith(prefix)) return;

    const args = body.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ==== BASIC COMMANDS ====
    if (command === "halo") return sock.sendMessage(sender, { text: `Halo juga, ${pushname}! 👋` });
    if (command === "ping") return sock.sendMessage(sender, { text: "Pong! 🏓" });
    if (command === "info") return sock.sendMessage(sender, { text: "Bot WhatsApp Termux v2.0\nAuthor: Kamu" });
    if (command === "bantuan") {
        const help = `
*Basic:* halo, ping, info, bantuan
*Admin:* kick, ban, promote, demote, mute, unmute, setgroupname, setgrouppic
*ChatGPT:* chatgpt
*Game:* game <Batu/Kertas/Gunting>, tebak <angka>
*Fun:* quote, joke, fakta, meme
*Utilities:* sticker, shortlink, ceknomor
*Broadcast:* broadcast <pesan>
        `;
        return sock.sendMessage(sender, { text: help });
    }

    // ==== CHATGPT ====
    if (command === "chatgpt") {
        if (!args.length) return sock.sendMessage(sender, { text: "❌ Tulis pertanyaan" });
        try {
            const response = await axios.post("https://api.openai.com/v1/chat/completions", {
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: args.join(" ") }]
            }, { headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` }});
            return sock.sendMessage(sender, { text: response.data.choices[0].message.content });
        } catch {
            return sock.sendMessage(sender, { text: "❌ Gagal terhubung ke ChatGPT" });
        }
    }

    // ==== GAME ====
    if (command === "game") {
        const choices = ["Batu","Kertas","Gunting"];
        const userChoice = args[0];
        const botChoice = choices[Math.floor(Math.random()*3)];
        if (!choices.includes(userChoice)) return sock.sendMessage(sender, { text: "Gunakan: .game Batu/Kertas/Gunting" });

        let result = "Seri 🤝";
        if ((userChoice==="Batu"&&botChoice==="Gunting")||(userChoice==="Gunting"&&botChoice==="Kertas")||(userChoice==="Kertas"&&botChoice==="Batu")) result="Kamu Menang 🎉";
        else if(userChoice!==botChoice) result="Bot Menang 😎";

        return sock.sendMessage(sender, { text: `Kamu: ${userChoice}\nBot: ${botChoice}\nHasil: ${result}` });
    }

    if (command === "tebak") {
        const number = parseInt(args[0]);
        if (!number) return sock.sendMessage(sender, { text: "Gunakan: .tebak <angka 1-10>" });
        const answer = Math.floor(Math.random()*10)+1;
        const result = number===answer?"🎉 Kamu benar!":`❌ Salah, jawabannya ${answer}`;
        return sock.sendMessage(sender, { text: result });
    }

    // ==== FUN ====
    if (command === "quote") return sock.sendMessage(sender, { text: "“Hidup itu seperti coding, kadang error kadang sukses.”" });
    if (command === "joke") return sock.sendMessage(sender, { text: "Kenapa programmer suka gelap? Karena takut bug! 😆" });
    if (command === "fakta") {
        try {
            const res = await axios.get("https://api.publicapis.org/entries"); // contoh API random fakta
            const fact = res.data.entries[Math.floor(Math.random()*res.data.entries.length)].Description || "Fakta keren!";
            return sock.sendMessage(sender, { text: fact });
        } catch { return sock.sendMessage(sender, { text: "❌ Gagal ambil fakta" }); }
    }
    if (command === "meme") {
        try {
            const res = await axios.get("https://meme-api.com/gimme");
            return sock.sendMessage(sender, { image: { url: res.data.url }, caption: res.data.title });
        } catch { return sock.sendMessage(sender, { text: "❌ Gagal ambil meme" }); }
    }

    // ==== UTILITIES ====
    if (command === "sticker") return sock.sendMessage(sender, { text: "❌ Sticker belum support tanpa sharp di Termux" });
    if (command === "shortlink") {
        const url = args[0];
        if (!url) return sock.sendMessage(sender, { text: "Gunakan: .shortlink <url>" });
        try {
            const res = await axios.get(`https://api.shrtco.de/v2/shorten?url=${encodeURIComponent(url)}`);
            return sock.sendMessage(sender, { text: `Shortlink: ${res.data.result.full_short_link}` });
        } catch { return sock.sendMessage(sender, { text: "❌ Gagal membuat shortlink" }); }
    }
    if (command === "ceknomor") {
        const nomor = args[0];
        if (!nomor) return sock.sendMessage(sender, { text: "Gunakan: .ceknomor <nomor>" });
        return sock.sendMessage(sender, { text: `Nomor yang dicek: ${nomor}` });
    }

    // ==== ADMIN COMMANDS ====
    if (!isGroup) return;
    const groupMetadata = await sock.groupMetadata(sender);
    const participants = groupMetadata.participants;
    const isAdmin = participants.find(u => u.id===msg.key.participant)?.admin || false;

    if (command==="kick" && isAdmin) return sock.sendMessage(sender, { text: "Fitur kick tersedia di WhatsApp Web API (implementasi lanjut)" });
    if (command==="ban" && isAdmin) return sock.sendMessage(sender, { text: "Fitur ban tersedia di WhatsApp Web API (implementasi lanjut)" });
    if (command==="promote" && isAdmin) return sock.sendMessage(sender, { text: "Fitur promote tersedia di WhatsApp Web API (implementasi lanjut)" });
    if (command==="demote" && isAdmin) return sock.sendMessage(sender, { text: "Fitur demote tersedia di WhatsApp Web API (implementasi lanjut)" });
    if (command==="mute" && isAdmin) return sock.sendMessage(sender, { text: "Fitur mute tersedia di WhatsApp Web API (implementasi lanjut)" });
    if (command==="unmute" && isAdmin) return sock.sendMessage(sender, { text: "Fitur unmute tersedia di WhatsApp Web API (implementasi lanjut)" });
    if (command==="setgroupname" && isAdmin) return sock.sendMessage(sender, { text: "Fitur set group name tersedia di WhatsApp Web API (implementasi lanjut)" });
    if (command==="setgrouppic" && isAdmin) return sock.sendMessage(sender, { text: "Fitur set group pic tersedia di WhatsApp Web API (implementasi lanjut)" });

    if (command === "broadcast" && isAdmin) {
        const text = args.join(" ");
        if (!text) return sock.sendMessage(sender, { text: "❌ Tulis pesan broadcast" });
        const chats = await sock.chats.all();
        for (const chat of chats) {
            await sock.sendMessage(chat.jid, { text });
        }
        return sock.sendMessage(sender, { text: "✅ Broadcast selesai" });
    }
};
