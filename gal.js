module.exports = async (gal, m) => {
    const msg = m.messages?.[0];
    if (!msg?.message) return;

    const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

    const sender = msg.key.remoteJid;
    const pushname = msg.pushName || "Gal";

    if (!body.startsWith("|")) return;

    const command = body.slice(1).trim().toLowerCase();
    console.log(`📩 Perintah diterima: ${command}`);

    switch (command) {
        case "halo":
            await gal.sendMessage(sender, { text: `Halo juga, ${pushname}! 👋` });
            break;

        case "ping":
            await gal.sendMessage(sender, { text: "Pong! 🏓" });
            break;

        default:
            await gal.sendMessage(sender, { text: "Perintah tidak dikenali ❌" });
            break;
    }
};
