// gal.js
const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');
const fs = require('fs');
const sharp = require('sharp');

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

module.exports = async (sock, m, getPrefix, setPrefix) => {
    const msg = m.messages?.[0];
    if (!msg?.message) return;

    const sender = msg.key.remoteJid;
    const isGroup = sender.endsWith("@g.us");
    const pushname = msg.pushName || "User";

    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    let prefix = getPrefix();
    if (!body.startsWith(prefix)) return;

    const args = body.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    let isAdmin = false;
    let groupAdmins = [];
    if (isGroup) {
        const metadata = await sock.groupMetadata(sender);
        groupAdmins = metadata.participants.filter(p => p.admin).map(p => p.id);
        isAdmin = groupAdmins.includes(msg.key.participant || "");
    } else isAdmin = true;

    // ===== BASIC =====
    switch(command){
        case "halo":
            await sock.sendMessage(sender, { text: `Halo juga, ${pushname}! 👋` });
            break;
        case "ping":
            await sock.sendMessage(sender, { text: "Pong! 🏓" });
            break;
        case "info":
            await sock.sendMessage(sender, { text: "Saya bot WhatsApp versi terbaik ✅" });
            break;
        case "bantuan":
            await sock.sendMessage(sender, { text: "Commands:\nBasic, Admin, ChatGPT, Game, Fun, Utilities, Broadcast" });
            break;
    }

    // ===== ADMIN =====
    if(isAdmin && isGroup){
        const adminCmds = ["kick","ban","promote","demote"];
        if(adminCmds.includes(command)){
            if(!msg.message.extendedTextMessage?.contextInfo?.mentionedJid)
                return sock.sendMessage(sender, { text: "❌ Mention user" });
            const actionMap = { kick: "remove", ban: "remove", promote: "promote", demote: "demote" };
            for(const jid of msg.message.extendedTextMessage.contextInfo.mentionedJid){
                await sock.groupParticipantsUpdate(sender, [jid], actionMap[command]);
            }
            await sock.sendMessage(sender, { text: `✅ User berhasil ${command}` });
        }
    }

    // ===== CHATGPT =====
    if(command === "chatgpt"){
        if(!args.length) return sock.sendMessage(sender,{text:"❌ Silakan tulis pertanyaan"});
        const resp = await openai.createChatCompletion({model:"gpt-3.5-turbo", messages:[{role:"user",content:args.join(" ")}]});
        await sock.sendMessage(sender,{text:resp.data.choices[0].message.content});
    }

    // ===== GAME =====
    if(command === "batu" || command === "gunting" || command === "kertas"){
        const choices = ["Batu","Gunting","Kertas"];
        const botChoice = choices[Math.floor(Math.random()*3)];
        let result = "Seri 🤝";
        if((command==="Batu"&&botChoice==="Gunting")||(command==="Gunting"&&botChoice==="Kertas")||(command==="Kertas"&&botChoice==="Batu")) result="Kamu Menang 🎉";
        else if(command!==botChoice) result="Bot Menang 😎";
        await sock.sendMessage(sender,{text:`Kamu: ${command}\nBot: ${botChoice}\nHasil: ${result}`});
    }

    // ===== FUN =====
    if(command==="joke"){
        const res = await axios.get("https://v2.jokeapi.dev/joke/Any");
        const joke = res.data.type==="single"?res.data.joke:`${res.data.setup}\n${res.data.delivery}`;
        await sock.sendMessage(sender,{text:joke});
    }
    if(command==="quote"){
        const res = await axios.get("https://api.quotable.io/random");
        await sock.sendMessage(sender,{text:`"${res.data.content}" — ${res.data.author}`});
    }

    // ===== BROADCAST =====
    if(command==="broadcast" && isAdmin){
        if(!args.length) return sock.sendMessage(sender,{text:"❌ Tulis pesan broadcast"});
        const chats = await sock.chats.all();
        let success=0, failed=0;
        for(const c of chats){
            if(c.id.endsWith("@g.us")){
                try { await sock.sendMessage(c.id,{text:args.join(" ")}); success++; } 
                catch{ failed++; }
            }
        }
        await sock.sendMessage(sender,{text:`✅ Broadcast selesai\nSukses: ${success}\nGagal: ${failed}`});
    }
};


