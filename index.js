const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
let chalk;
(async () => {
    try { chalk = require("chalk"); if (typeof chalk.blue !== "function") throw 0; await startBot(); } 
    catch { const mod = await import("chalk"); chalk = new Proxy(mod.default, { get(t,p){ return t[p]||((...a)=>t(...a)) } }); await startBot(); }
})();

async function startBot() {
    console.log(chalk.blue("Memulai koneksi ke WhatsApp..."));
    const { state, saveCreds } = await useMultiFileAuthState("./GalSesi");

    const gal = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: true,
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

    gal.ev.on("messages.upsert", async (m) => {
        const msg = m.messages?.[0];
        if (!msg?.message) return;
        try { require("./gal")(gal, m); }
        catch (err) { console.error(chalk.red("Gagal memuat handler 'gal.js':"), err); }
    });
}
