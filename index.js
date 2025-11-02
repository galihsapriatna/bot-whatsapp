// import Module
const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");
const chalk = require("chalk");
const readline = require("readline"); // <- salah tulis sebelumnya "redline"
const { resolve } = require("path");
const { version } = require("os");

// Metode Pairing
// true = Pairing code || false = Scan QR
const usePairingCode = true;

// Prompt Input Terminal
async function question(prompt) {
    process.stdout.write(prompt);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => rl.question("", (ans) => {
        rl.close();
        resolve(ans);
    }));
}

// Koneksi WhatsApp
async function connectToWhatsApp() {
    console.log(chalk.blue("Memulai koneksi ke WhatsApp..."));

    // Menyimpan sesi login
    const { state, saveCreds } = await useMultiFileAuthState("./GalSesi"); // <- pakai { } bukan ( )

    // Membuat koneksi WhatsApp
    const gal = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: !usePairingCode,
        auth: state, // pakai sesi yang ada
        browser: ["Ubuntu", "Chrome", "20.0.04"], // simulasi browser
        version: [2, 3000, 1015901307], // versi WhatsApp
    });

    // Metode Pairing Code
    if (usePairingCode && !gal.authState.creds.registered) {
        console.log(chalk.green("Masukkan Nomor Dengan Awalan 62"));
        const phoneNumber = await question("=> ");
        const code = await gal.requestPairingCode(phoneNumber.trim());
        console.log(chalk.cyan(`Pairing Code: ${code}`)); // gunakan backtick `
    }

    // Menyimpan Sesi Login
    gal.ev.on("creds.update", saveCreds);

    // Informasi koneksi
    gal.ev.on("connection.update", (update) => { // <- huruf kecil "connection.update"
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            console.log(chalk.red("Koneksi terputus, mencoba menyambungkan ulang..."));
            connectToWhatsApp();
        } else if (connection === "open") {
            console.log(chalk.green("Bot berhasil terhubung ke WhatsApp ✅"));
        }
    });
}

// Jalankan koneksi WhatsApp
connectToWhatsApp();
