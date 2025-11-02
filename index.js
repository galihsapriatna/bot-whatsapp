const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");

// ====== Auto Deteksi Chalk (v4 & v5) ======
let chalk;
(async () => {
    try {
        chalk = require("chalk");
        if (typeof chalk.blue !== "function") throw new Error("Chalk v5 detected");
    } catch {
        const mod = await import("chalk");
        chalk = new Proxy(mod.default, {
            get(target, prop) {
                return target[prop] || ((...args) => target(...args));
            },
        });
    }
    await connectToWhatsApp();
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
    const { state, saveCreds } = await useMultiFileAuthState("./GalSesi");

    const gal = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        version: [2, 3000, 1015901307],
    });

    // Simpan sesi login
    gal.ev.on("creds.update", saveCreds);

    // ====== Tunggu koneksi terbuka ======
    gal.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            console.log(chalk.green("✅ Bot berhasil terhubung ke WhatsApp!"));
        } else if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(chalk.red("Koneksi terputus..."), shouldReconnect ? "Menyambung ulang..." : "");
            if (shouldReconnect) connectToWhatsApp();
        }
    });

    // ====== Pairing Code (versi aman) ======
    if (usePairingCode && !gal.authState.creds.registered) {
        console.log(chalk.green("Masukkan Nomor Dengan Awalan 62 (contoh: 6281234567890)"));
        const phoneNumber = await question("=> ");
        const formattedNumber = phoneNumber.replace(/[^0-9]/g, "");
        if (!formattedNumber.startsWith("62")) {
            console.log(chalk.red("❌ Nomor harus diawali 62, bukan 0!"));
            process.exit(1);
        }

        // 🔥 Tunggu socket siap sebelum pairing
        await new Promise((resolve) => setTimeout(resolve, 5000));

        try {
            const code = await gal.requestPairingCode(formattedNumber);
            console.log(chalk.cyan(`✅ Pairing Code Anda: ${code}`));
        } catch (err) {
            console.error(chalk.red("❌ Gagal mendapatkan pairing code. Ulangi lagi setelah 10 detik."));
            console.error("Alasan:", err.message || err);
            process.exit(1);
        }
    }

    // ====== Pesan Masuk ======
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
