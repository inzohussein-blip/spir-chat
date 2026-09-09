// One-time interactive login. Run `npm run login`, enter the phone/code/2FA for
// the Telegram account that will send campaign messages, then copy the printed
// TELEGRAM_SESSION string into this service's environment. Keep it secret — it
// is full access to that account.
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const readline = require("readline");

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a.trim()); }));
}

(async () => {
  if (!apiId || !apiHash) {
    console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH first (get them at https://my.telegram.org).");
    process.exit(1);
  }
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
  await client.start({
    phoneNumber: () => ask("Phone (+countrycode…): "),
    password: () => ask("2FA password (blank if none): "),
    phoneCode: () => ask("Login code you received: "),
    onError: (e) => console.error(e),
  });
  console.log("\nLogged in. Set this as TELEGRAM_SESSION in the gateway env:\n");
  console.log(client.session.save());
  await client.disconnect();
  process.exit(0);
})();
