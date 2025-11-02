const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require("@adiwajshing/baileys");
const { state, saveState } = useSingleFileAuthState("./auth_info.json");
const chalk = require("chalk");

const gal = require("./gal");

const startBot = async () => {
    console.log(chalk.blue("Memulai koneksi ke WhatsApp..."));

    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`Terputus, code: ${reason}`));
            startBot();
        } else if (connection === "open") {
            console.log(chalk.green("Bot berhasil terhubung ✅"));
        }
    });

    sock.ev.on("creds.update", saveState);

    sock.ev.on("messages.upsert", async (m) => {
        gal(sock, m);
    });
};

startBot();
