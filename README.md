# Voicebook

A voice-powered customer ledger — speak, and the customer's name plus advance/qarza (credit) amount get logged automatically. The app's interface is in Roman Urdu; this README is in English.

## How to run

1. Install [Node.js](https://nodejs.org) if you don't already have it — version 18 or later.
2. Open a terminal and navigate into this folder:
   ```
   cd voicebook
   ```
3. Install dependencies (only needed the first time):
   ```
   npm install
   ```
4. Start the server:
   ```
   npm start
   ```
5. Open in your browser:
   ```
   http://localhost:3000
   ```

## Sharing with others on the same WiFi network

Find the local IP address of the machine running the server:

- **Mac/Linux**: run `ifconfig` (or `ip addr`) in a terminal
- **Windows**: run `ipconfig`

Then, from any other phone or laptop connected to the same WiFi, open this address in a browser:

```
http://<your-IP>:3000
```

Example: `http://192.168.1.14:3000`

Everyone connects to the same server, so all data is shared and saved in one place.

## Where data is saved

Everything is saved in the `data/ledger.json` file inside the server's folder. As long as that file isn't deleted, data survives closing the server or restarting the machine.

## Voice tips

Press the mic button and speak a simple line, for example:

- "Ahmed advance 5000"
- "Bilal qarza 2000"

The app tries to automatically extract the name, amount, and type (advance/qarza) — but it always shows a confirmation screen first, where you can correct anything before hitting Save. If voice recognition doesn't catch it correctly, you can use the "manually likho" link to type it directly instead.
