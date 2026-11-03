const express=require("express");
const QRCode=require("qrcode");
const pino=require("pino");
const fs=require("fs");
const path=require("path");
const {default:makeWASocket,useMultiFileAuthState,DisconnectReason}=require("@whiskeysockets/baileys");

const app=express();
app.use(express.json({limit:"1mb"}));
app.use(express.static(__dirname));

const PORT=process.env.PORT||3000;
const AUTH_DIR=path.resolve("./auth_info_baileys");

let sock=null,qrDataUrl=null,status="starting",lastError=null;
let manualDisconnect=false;

async function startWhatsApp(){
  manualDisconnect=false;
  const {state,saveCreds}=await useMultiFileAuthState(AUTH_DIR);

  sock=makeWASocket({
    auth:state,
    logger:pino({level:"silent"}),
    printQRInTerminal:false
  });

  sock.ev.on("creds.update",saveCreds);

  sock.ev.on("connection.update",async u=>{
    const {connection,lastDisconnect,qr}=u;

    if(qr){
      qrDataUrl=await QRCode.toDataURL(qr);
      status="scan_qr";
      lastError=null;
    }

    if(connection==="open"){
      qrDataUrl=null;
      status="connected";
      lastError=null;
    }

    if(connection==="close"){
      sock=null;

      if(manualDisconnect){
        status="disconnected";
        qrDataUrl=null;
        return;
      }

      status="disconnected";
      const code=lastDisconnect?.error?.output?.statusCode;

      if(code!==DisconnectReason.loggedOut){
        setTimeout(startWhatsApp,3000);
      }else{
        status="disconnected";
      }
    }
  });
}

app.get("/api/status",(req,res)=>{
  res.json({status,qr:qrDataUrl,lastError});
});

/* Putus hubungan WhatsApp dan hapus sesi,
   sehingga setelah itu QR baru bisa muncul. */
app.post("/api/disconnect",async(req,res)=>{
  try{
    manualDisconnect=true;

    if(sock){
      try{ await sock.logout(); }catch(e){}
      sock=null;
    }

    await new Promise(r=>setTimeout(r,500));

    if(fs.existsSync(AUTH_DIR)){
      fs.rmSync(AUTH_DIR,{recursive:true,force:true});
    }

    qrDataUrl=null;
    status="disconnected";
    lastError=null;

    res.json({ok:true});
  }catch(e){
    manualDisconnect=false;
    res.status(500).json({error:e.message});
  }
});

app.post("/api/reconnect",async(req,res)=>{
  try{
    if(sock) return res.json({ok:true,status});
    status="starting";
    lastError=null;
    await startWhatsApp();
    res.json({ok:true});
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.post("/api/send",async(req,res)=>{
  try{
    const {number,message,optInConfirmed}=req.body||{};

    if(!optInConfirmed)
      return res.status(400).json({error:"Konfirmasi opt-in wajib."});

    if(!number||!message)
      return res.status(400).json({error:"Nomor dan pesan wajib."});

    if(status!=="connected"||!sock)
      return res.status(503).json({error:"WhatsApp belum tersambung."});

    const n=String(number).replace(/\D/g,"");

    if(n.length<8)
      return res.status(400).json({error:"Nomor tidak valid."});

    const result=await sock.sendMessage(
      n+"@s.whatsapp.net",
      {text:String(message)}
    );

    res.json({
      ok:true,
      messageId:result?.key?.id||null
    });
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.listen(PORT,()=>{
  console.log("Kink Sanz PushKontak QR berjalan di port "+PORT);
  startWhatsApp().catch(console.error);
});
