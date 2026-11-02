const express = require("express");
const crypto = require("crypto");
const path = require("path");
const app = express();

app.use(express.json({limit:"1mb"}));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 8080;
const WA_TOKEN = process.env.WA_TOKEN;
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

function validSignature(req){
  if(!META_APP_SECRET) return true;
  const sig=req.get("x-hub-signature-256")||"";
  if(!sig.startsWith("sha256=")) return false;
  const expected="sha256="+crypto.createHmac("sha256",META_APP_SECRET)
    .update(JSON.stringify(req.body)).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));
}

app.get("/webhook",(req,res)=>{
  const mode=req.query["hub.mode"];
  const token=req.query["hub.verify_token"];
  const challenge=req.query["hub.challenge"];
  if(mode==="subscribe" && token===VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post("/webhook",(req,res)=>{
  if(!validSignature(req)) return res.sendStatus(403);
  res.sendStatus(200);
  console.log("WhatsApp webhook:",JSON.stringify(req.body));
});

app.get("/health",(req,res)=>res.json({ok:true}));

app.post("/api/pushkontak",async(req,res)=>{
  try{
    const {to,template,language="id"}=req.body||{};
    if(!to||!template) return res.status(400).json({error:"to dan template wajib"});
    if(!WA_TOKEN||!WA_PHONE_NUMBER_ID) return res.status(500).json({error:"WA_TOKEN atau WA_PHONE_NUMBER_ID belum diset di FadeHost"});

    const response=await fetch(
      `https://graph.facebook.com/v23.0/${WA_PHONE_NUMBER_ID}/messages`,
      {
        method:"POST",
        headers:{
          "Authorization":`Bearer ${WA_TOKEN}`,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          messaging_product:"whatsapp",
          to,
          type:"template",
          template:{name:template,language:{code:language}}
        })
      }
    );
    const data=await response.json();
    if(!response.ok) return res.status(response.status).json({error:data});
    res.json({ok:true,data});
  }catch(e){
    console.error(e);
    res.status(500).json({error:e.message});
  }
});

app.listen(PORT,"0.0.0.0",()=>console.log("Kink Sanz PushKontak running on "+PORT));