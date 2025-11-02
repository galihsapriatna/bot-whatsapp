// ====== Import Module ======
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");

// ====== Auto Deteksi Chalk (v4 dan v5) ======
let chalk;
(async () => {
    try {
        chalk = require("chalk");
        if (typeof chalk.blue !== "function") throw new Error("Chalk v5 detected");
        await startBot(); // jalankan bot kalau chalk v4
    } catch {
        const mod = await import("chalk");
        chalk = new Proxy(mod.default, {
            get(target, prop) {
                return target[prop] || ((...args) => target(...args));
            },
        });
        await startBot(); // jalankan bot setelah chalk siap
    }
})();

// ====== Fungsi Input Terminal ======
function question(prompt) {
    process.stdout.write(prompt);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question("", (ans) => { rl.close(); resolve(ans); }));
}

// ====== Konfigurasi ======
const usePairingCode = true; // true = pakai pairing code, false = pakai QR
let gal; // socket global
let isPairingDone = false;

// ====== Fungsi Start Bot ======
async function startBot() {
    console.log(chalk.blue("Memulai koneksi ke WhatsApp..."));
    
    const { state, saveCreds } = await useMultiFileAuthState("./GalSesi");

    gal = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        version: [2, 3000, 1015901307],
    });

    gal.ev.on("creds.update", saveCreds);

    gal.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            console.log(chalk.green("✅ Bot berhasil terhubung ke WhatsApp!"));

            // Pairing code hanya sekali
            if (usePairingCode && !isPairingDone && !gal.authState.creds.registered) {
                isPairingDone = true;
                try {
                    await doPairing();
                } catch (err) {
                    console.log(chalk.red("❌ Pairing gagal, fallback ke QR Code"));
                    gal.logout(); // logout supaya socket reset
                }
            }
        } else if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;

            console.log(chalk.red("⚠️ Koneksi terputus"), shouldReconnect ? chalk.yellow("Menyambung ulang...") : chalk.red("Bot keluar"));
            if (shouldReconnect) setTimeout(startBot, 5000);
        }
    });

    gal.ev.on("messages.upsert", async (m) => {
        const msg = m.messages?.[0];
        if (!msg?.message) return;

        try {
            require("./gal")(gal, m);
        } catch (err) {
            console.error(chalk.red("Gagal memuat handler 'gal.js':"), err);
        }
    });
}

// ====== Fungsi Pairing ======
async function doPairing() {
    console.log(chalk.green("Masukkan Nomor Dengan Awalan 62 (contoh: 6281234567890)"));
    const phoneNumber = await question("=> ");
    const formattedNumber = phoneNumber.replace(/[^0-9]/g, "");

    if (!formattedNumber.startsWith("62")) {
        console.log(chalk.red("❌ Nomor harus diawali 62!"));
        process.exit(1);
    }

    try {
        // Tunggu socket siap
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const code = await gal.requestPairingCode(formattedNumber);
        console.log(chalk.cyan(`✅ Pairing Code Anda: ${code}`));
    } catch (err) {
        console.error(chalk.red("❌ Gagal mendapatkan pairing code."), err.message || err);
        throw err; // lempar supaya fallback ke QR Code
    }
}
