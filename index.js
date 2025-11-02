const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal"); // npm install qrcode-terminal

let chalk;

(async () => {
    try {
        chalk = require("chalk");
        if (typeof chalk.blue !== "function") throw 0;
        await startBot();
    } catch {
        const mod = await import("chalk");
        chalk = new Proxy(mod.default, {
            get(target, prop) {
                return target[prop] || ((...args) => target(...args));
            },
        });
        await startBot();
    }
})();

async function startBot() {
    console.log(chalk.blue("🔌 Memulai koneksi ke WhatsApp..."));

    const { state, saveCreds } = await useMultiFileAuthState("./GalSesi");

    const gal = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
    });

    gal.ev.on("creds.update", saveCreds);

    gal.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Tangani QR code
        if (qr) {
            console.log(chalk.yellow("📲 Scan QR ini untuk login:"));
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log(chalk.green("✅ Bot terhubung ke WhatsApp"));
        } else if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            console.log(chalk.red("⚠️ Koneksi terputus"), shouldReconnect ? chalk.yellow("Menyambung ulang...") : chalk.red("Bot keluar permanen"));
            if (shouldReconnect) setTimeout(startBot, 5000);
        }
    });

    gal.ev.on("messages.upsert", async (m) => {
        const msg = m.messages?.[0];
        if (!msg?.message) return;

        try {
            require("./gal")(gal, m);
        } catch (err) {
            console.error(chalk.red("❌ Gagal memproses pesan:"), err);
        }
    });
}
