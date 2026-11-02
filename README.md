# Kink Sanz PushKontak — FadeHost

## Deploy
1. Upload/push this folder to a GitHub repository.
2. FadeHost → Bots → Host a WhatsApp bot, or Apps → Host an app.
3. Choose Node.js.
4. Start command: `npm start`.
5. Give the app a web address.
6. Add environment variables:
   - `WA_TOKEN` = Meta System User access token
   - `WA_PHONE_NUMBER_ID` = WhatsApp phone number ID
   - `META_APP_SECRET` = Meta app secret
   - `VERIFY_TOKEN` = random verification token you choose
7. Deploy.

Webhook:
`https://NAMA-APP.fadehost.app/webhook`

The dashboard is at:
`https://NAMA-APP.fadehost.app/`

The scheduler uses random 60–90 second delays and pauses for 1 hour after every 30 processed contacts.

Use only recipients who have opted in and approved WhatsApp templates.

Do NOT put tokens into `index.html`.
