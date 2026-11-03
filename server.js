const express = require("express");
const QRCode = require("qrcode");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const AUTH_DIR = process.env.AUTH_DIR || "./auth_info_baileys";

let sock = null;
let qrDataUrl = null;
let status = "starting";
let lastError = null;

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrDataUrl = await QRCode.toDataURL(qr);
      status = "scan_qr";
    }

    if (connection === "open") {
      qrDataUrl = null;
      status = "connected";
      lastError = null;
    }

    if (connection === "close") {
      status = "disconnected";
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(startWhatsApp, 3000);
      } else {
        lastError = "WhatsApp logout. Hapus folder auth_info_baileys lalu deploy ulang.";
      }
    }
  });
}

app.get("/api/status", (req, res) => {
  res.json({
    status,
    qr: qrDataUrl,
    lastError
  });
});

app.post("/api/send", async (req, res) => {
  try {
    const { number, message, optInConfirmed } = req.body || {};

    if (!optInConfirmed) {
      return res.status(400).json({
        error: "Centang konfirmasi bahwa penerima sudah opt-in."
      });
    }

    if (!number || !message) {
      return res.status(400).json({
        error: "Nomor dan pesan wajib diisi."
      });
    }

    if (status !== "connected" || !sock) {
      return res.status(503).json({
        error: "WhatsApp belum tersambung."
      });
    }

    const digits = String(number).replace(/\D/g, "");
    if (digits.length < 8) {
      return res.status(400).json({ error: "Nomor WhatsApp tidak valid." });
    }

    const jid = digits + "@s.whatsapp.net";
    const result = await sock.sendMessage(jid, { text: String(message) });

    res.json({
      ok: true,
      messageId: result?.key?.id || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`Kink Sanz PushKontak QR jalan di port ${PORT}`);
  await startWhatsApp();
});
