const { default: makeWASocket, DisconnectReason, useSingleFileAuthState, fetchLatestBaileysVersion, delay } = require("@adiwajshing/baileys");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { Configuration, OpenAIApi } = require("openai");

const { state, saveState } = useSingleFileAuthState("./auth_info.json");

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

const prefix = ".";
let botStart = Date.now();

// ===== START BOT =====
async function startBot() {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    const gal = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true
    });

    gal.ev.on('creds.update', saveState);

    gal.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if ((lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
                startBot();
            } else {
                console.log("Logged out. Please delete auth_info.json and scan QR again.");
            }
        } else if (connection === 'open') {
            console.log("Bot connected ✅");
        }
    });

    gal.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const isGroup = sender.endsWith("@g.us");
        const pushname = msg.pushName || "User";
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
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

        switch (command) {

            // ==== BASIC COMMANDS ====
            case "halo":
                await gal.sendMessage(sender, { text: `Halo juga, ${pushname}! 👋` });
                break;

            case "ping":
                await gal.sendMessage(sender, { text: `Pong! 🏓` });
                break;

            case "info":
                await gal.sendMessage(sender, { text: `Bot berjalan sejak: ${new Date(botStart).toLocaleString()}` });
                break;

            case "bantuan":
                await gal.sendMessage(sender, { text: `Command tersedia:\nBasic: halo, ping, info, bantuan\nAdmin: kick, ban, promote, demote, mute, unmute, setgroupname, setgrouppic\nChatGPT: chatgpt\nGame: game, tebakangka\nFun: quote, joke, fakta, meme\nUtilities: sticker, shortlink, ceknomor\nBroadcast: broadcast` });
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
                const choices = ["batu", "kertas", "gunting"];
                const userChoice = args[0]?.toLowerCase();
                const botChoice = choices[Math.floor(Math.random() * choices.length)];
                if (!choices.includes(userChoice)) return gal.sendMessage(sender, { text: "Gunakan: .game batu/kertas/gunting" });

                let result = "Seri 🤝";
                if ((userChoice === "batu" && botChoice === "gunting") ||
                    (userChoice === "gunting" && botChoice === "kertas") ||
                    (userChoice === "kertas" && botChoice === "batu")) result = "Kamu Menang 🎉";
                else if (userChoice !== botChoice) result = "Bot Menang 😎";

                await gal.sendMessage(sender, { text: `Kamu: ${userChoice}\nBot: ${botChoice}\nHasil: ${result}` });
                break;

            case "tebakangka":
                const randomNum = Math.floor(Math.random() * 10) + 1;
                const guess = parseInt(args[0]);
                if (!guess) return gal.sendMessage(sender, { text: "Gunakan: .tebakangka [1-10]" });
                let msgText = guess === randomNum ? "🎉 Tebakan kamu benar!" : `❌ Salah! Angka yang benar: ${randomNum}`;
                await gal.sendMessage(sender, { text: msgText });
                break;

            // ==== FUN COMMANDS ====
            case "quote":
                try {
                    const res = await axios.get("https://api.quotable.io/random");
                    await gal.sendMessage(sender, { text: `"${res.data.content}" — ${res.data.author}` });
                } catch {
                    await gal.sendMessage(sender, { text: "Gagal mengambil quote" });
                }
                break;

            case "joke":
                try {
                    const res = await axios.get("https://v2.jokeapi.dev/joke/Any");
                    let joke = res.data.type === "single" ? res.data.joke : `${res.data.setup}\n${res.data.delivery}`;
                    await gal.sendMessage(sender, { text: joke });
                } catch {
                    await gal.sendMessage(sender, { text: "Gagal mengambil joke" });
                }
                break;

            case "fakta":
                try {
                    const res = await axios.get("https://asli-fakta.vercel.app/api/fakta/random");
                    await gal.sendMessage(sender, { text: res.data.fakta });
                } catch {
                    await gal.sendMessage(sender, { text: "Gagal mengambil fakta" });
                }
                break;

            case "meme":
                try {
                    const res = await axios.get("https://meme-api.com/gimme");
                    await gal.sendMessage(sender, { text: `${res.data.title}\n${res.data.url}` });
                } catch {
                    await gal.sendMessage(sender, { text: "Gagal mengambil meme" });
                }
                break;

            // ==== UTILITIES ====
            case "sticker":
                if (msg.message.imageMessage?.mimetype.startsWith("image/")) {
                    const buffer = await gal.downloadMediaMessage(msg);
                    await gal.sendMessage(sender, { sticker: buffer });
                } else {
                    await gal.sendMessage(sender, { text: "Kirim gambar dengan caption .sticker" });
                }
                break;

            case "shortlink":
                if (!args[0]) return gal.sendMessage(sender, { text: "Gunakan: .shortlink [url]" });
                try {
                    const res = await axios.get(`https://api.shrtco.de/v2/shorten?url=${args[0]}`);
                    await gal.sendMessage(sender, { text: res.data.result.full_short_link });
                } catch {
                    await gal.sendMessage(sender, { text: "Gagal membuat shortlink" });
                }
                break;

            case "ceknomor":
                if (!args[0]) return gal.sendMessage(sender, { text: "Gunakan: .ceknomor [nomor]" });
                await gal.sendMessage(sender, { text: `Nomor dicek: ${args[0]}` });
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
                await gal.sendMessage(sender, { text: `Command ${command} dijalankan! (Dummy di versi Termux)` });
                break;

            // ==== BROADCAST ====
            case "broadcast":
                if (!isAdmin) return gal.sendMessage(sender, { text: "❌ Hanya admin yang bisa broadcast" });
                if (!args.length) return gal.sendMessage(sender, { text: "❌ Tulis pesan untuk broadcast" });

                const chats = await gal.chats.all();
                let success = 0, failed = 0;
                for (const c of chats) {
                    if (c.id.endsWith("@g.us")) {
                        try { await gal.sendMessage(c.id, { text: args.join(" ") }); success++; } catch { failed++; }
                    }
                }
                await gal.sendMessage(sender, { text: `✅ Broadcast selesai\nSukses: ${success}\nGagal: ${failed}` });
                break;

            default:
                await gal.sendMessage(sender, { text: "❌ Perintah tidak dikenali" });
        }
    });
}

startBot();
