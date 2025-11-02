// ====== Import Module ======
const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const { resolve } = require("path");
const { version } = require("os");

// ====== Auto Deteksi Chalk (v4 dan v5) ======
let chalk;
(async () => {
    try {
        // Coba import biasa (Chalk v4 / CommonJS)
        chalk = require("chalk");
        if (typeof chalk.blue !== "function") throw new Error("Chalk v5 detected");
        await connectToWhatsApp(); // jalankan langsung kalau chalk v4
    } catch {
        // Jika Chalk v5+, import sebagai ESM
        const mod = await import("chalk");
        chalk = new Proxy(mod.default, {
            get(target, prop) {
                // biar chalk.blue(), chalk.red(), dll tetap berfungsi
                return target[prop] || ((...args) => target(...args));
            },
        });
        await connectToWhatsApp(); // jalankan setelah chalk siap
    }
})();

// ====== Opsi Pairing ======
const usePairingCode = true;

// ====== Fungsi Input Terminal ======
async function question(prompt) {
    process.stdout.write(prompt);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) =>
        rl.question("", (ans) => {
            rl.close();
            resolve(ans);
        })
    );
}

// ====== Koneksi WhatsApp ======
async function connectToWhatsApp() {
    console.log(chalk.blue("Memulai koneksi ke WhatsApp..."));

    // Simpan sesi login
    const { state, saveCreds } = await useMultiFileAuthState("./GalSesi");

    // Membuat koneksi WhatsApp
    const gal = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        version: [2, 3000, 1015901307],
    });

    // Pairing code
    if (usePairingCode && !gal.authState.creds.registered) {
        console.log(chalk.green("Masukkan Nomor Dengan Awalan 62"));
        const phoneNumber = await question("=> ");
        const code = await gal.requestPairingCode(phoneNumber.trim());
        console.log(chalk.cyan(`Pairing Code: ${code}`));
    }

    // Simpan sesi login
    gal.ev.on("creds.update", saveCreds);

    // Info koneksi
    gal.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            console.log(chalk.red("Koneksi terputus, mencoba menyambungkan ulang..."));
            connectToWhatsApp();
        } else if (connection === "open") {
            console.log(chalk.green("Bot berhasil terhubung ke WhatsApp ✅"));
        }
    });

    // Respon pesan masuk
    gal.ev.on("messages.upsert", async (m) => {
        // ✅ Perbaikan: ambil pesan pertama dari array messages
        const msg = m.messages?.[0];
        if (!msg?.message) return;

        // Ambil isi pesan dan info pengirim
        const body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";
        const sender = msg.key.remoteJid;
        const pushname = msg.pushName || "Gal";

        // Jalankan handler eksternal
        try {
            require("./gal")(gal, m);
        } catch (err) {
            console.error(chalk.red("Gagal memuat handler 'gal.js':"), err);
        }
    });
}
