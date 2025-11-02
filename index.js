// index.js
const { 
    default: makeWASocket,
    useSingleFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore
} = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const gal = require('./gal.js'); // file command handler
const { state, saveState } = useSingleFileAuthState('./auth_info.json');

const startBot = async () => {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Menggunakan Baileys v${version.join('.')} | Terbaru: ${isLatest}`);

    const sock = makeWASocket({
        printQRInTerminal: true,
        logger: P({ level: 'silent' }),
        auth: state
    });

    const store = makeInMemoryStore({ logger: P({ level: 'silent' }) });
    store.bind(sock.ev);

    sock.ev.on('messages.upsert', async (m) => {
        try {
            await gal(sock, m, getPrefix, setPrefix);
        } catch (err) {
            console.error(err);
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Terputus, reconnect?', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('Bot sudah tersambung ✅');
        }
    });

    sock.ev.on('creds.update', saveState);
};

let prefix = '.';
const getPrefix = () => prefix;
const setPrefix = (p) => prefix = p;

startBot();


