require('dotenv').config();
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const chalk = require("chalk");
const galHandler = require("./gal");

let prefix = process.env.DEFAULT_PREFIX || ".";

async function startBot() {
    console.log(chalk.blue("Memulai koneksi ke WhatsApp..."));
    const { state, saveCreds } = await useMultiFileAuthState("./GalSesi");

    const gal = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
    });

    gal.ev.on("creds.update", saveCreds);

    gal.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") console.log(chalk.green("✅ Bot terhubung!"));
        else if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            console.log(chalk.red("⚠️ Koneksi terputus"), shouldReconnect ? chalk.yellow("Menyambung ulang...") : chalk.red("Bot keluar"));
            if (shouldReconnect) setTimeout(startBot, 5000);
        }
    });

    // ==== Auto-join hanya dari admin ====
    gal.ev.on("group-participants.update", async (update) => {
        const groupId = update.id;
        const action = update.action;
        const botNumber = gal.user.id.split(":")[0] + "@s.whatsapp.net";

        if (action === "add" && update.participants.includes(botNumber)) {
            const inviter = update.participants[0]; // yang invite bot
            const metadata = await gal.groupMetadata(groupId);
            const adminIds = metadata.participants.filter(p => p.admin).map(p => p.id);

            if (!adminIds.includes(inviter)) {
                console.log(chalk.red("Invite bot ditolak karena bukan admin"));
                await gal.groupLeave(groupId);
                return;
            }
            console.log(chalk.green("✅ Bot join otomatis dari admin"));
        }
    });

    gal.ev.on("messages.upsert", async (m) => {
        try {
            await galHandler(gal, m, () => prefix, (newPrefix) => { prefix = newPrefix; });
        } catch (err) {
            console.error(chalk.red("Error di galHandler:"), err);
        }
    });
}

startBot();
