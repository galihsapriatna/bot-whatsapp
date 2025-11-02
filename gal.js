module.exports = async (gal, m) => {
    // Cek apakah pesan ada
    const msg = m.messages?.[0]; // ambil pesan pertama dengan optional chaining
    if (!msg || !msg.message) return;

    // Ambil isi pesan (teks)
    const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

    const sender = msg.key.remoteJid;
    const pushname = msg.pushName || "Gal"; // benar: pushName pakai huruf besar N

    // Prefix (contoh: |halo)
    if (!body.startsWith("|")) return; // benar: cek prefix '|'

    // Ambil command setelah prefix
    const command = body.slice(1).trim().toLowerCase();

    // Log pesan masuk — pakai template literal yang benar (``)
    console.log(`Perintah diterima: ${command}`);

    // Eksekusi command
    switch (command) {
        case "halo":
            await gal.sendMessage(sender, { text: `Halo juga, ${pushname}! 👋` });
            break;

        case "ping":
            await gal.sendMessage(sender, { text: "Pong! 🏓" });
            break;

        default:
            // Optional: respon kalau command tidak dikenal
            await gal.sendMessage(sender, { text: "Perintah tidak dikenali ❌" });
            break;
    }
};
