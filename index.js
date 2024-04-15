const { connect, keyStores, KeyPair } = require("near-api-js");
const { readFileSync } = require("fs");
const moment = require("moment");
const crypto = require("crypto");
const http = require("http");
const url = require("url");

// LOAD ENV
require('dotenv').config();
const token = process.env.TELEGRAM_BOT_TOKEN;
const userId = process.env.TELEGRAM_USER_ID;

// INIT TELEGRAM BOT
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(token);

// Constants for proxy authentication
const PROXY_USERNAME = "proxy_login";
const PROXY_PASSWORD = "proxy_pas";

// CREATE DELAY IN MILLISECONDS
const delay = (timeInMinutes) => {
    return new Promise((resolve) => {
        return setTimeout(resolve, timeInMinutes * 60 * 1000);
    });
}

(async () => {
    // IMPORT LIST ACCOUNT
    const listAccounts = readFileSync("./private.txt", "utf-8")
        .split("\n")
        .map((a) => a.trim());

    console.log("Start claiming process");

    // CLAIMING PROCESS
    while (true) {
        console.log("Loop iteration start");

        // Shuffle accounts randomly
        const shuffledAccounts = listAccounts.sort(() => Math.random() - 0.5);

        for (const [index, value] of shuffledAccounts.entries()) {
            console.log("Processing account:", value);
            const [PRIVATE_KEY, ACCOUNT_ID, PROXY] = value.split("|");
            console.log("Proxy config from file:", PROXY);

            // Parsing proxy URL using the url module
            const proxyConfig = PROXY ? url.parse(`http://${PROXY}`) : null;

            console.log("Parsed proxy config:", proxyConfig);
            console.log(`Using proxy ${proxyConfig ? PROXY : "direct connection"} for claim request`);

            const myKeyStore = new keyStores.InMemoryKeyStore();
            const keyPair = KeyPair.fromString(PRIVATE_KEY);
            await myKeyStore.setKey("mainnet", ACCOUNT_ID, keyPair);
            console.log("Key set");

            const connection = await connect({
                networkId: "mainnet",
                nodeUrl: "https://rpc.mainnet.near.org",
                keyStore: myKeyStore,
            });
            console.log("Connected to NEAR");

            // Check if proxy is used
            if (proxyConfig) {
                try {
                    console.log("Checking proxy...");
                    const agent = new http.Agent({
                        host: proxyConfig.hostname,
                        port: proxyConfig.port,
                        auth: `${PROXY_USERNAME}:${PROXY_PASSWORD}`
                    });
                    const requestOptions = {
                        hostname: 'httpbin.org',
                        port: 80,
                        path: '/ip',
                        method: 'GET',
                        headers: {
                            'Proxy-Authorization': `Basic ${Buffer.from(`${PROXY_USERNAME}:${PROXY_PASSWORD}`).toString('base64')}`
                        },
                        agent: agent
                    };
                    const request = http.request(requestOptions, (response) => {
                        let data = '';
                        response.on('data', (chunk) => {
                            data += chunk;
                        });
                        response.on('end', () => {
                            console.log(`[${moment().format("HH:mm:ss")}] Proxy check response: ${data}`);
                        });
                    });
                    request.on('error', (error) => {
                        console.error(`[${moment().format("HH:mm:ss")}] Error checking proxy: ${error.message}`);
                    });
                    request.end();
                } catch (error) {
                    console.error(`[${moment().format("HH:mm:ss")}] Error checking proxy: ${error.message}`);
                }
            }

            const wallet = await connection.account(ACCOUNT_ID);
            console.log("Connected to wallet");

            console.log(
                `[${moment().format("HH:mm:ss")}] [${index + 1}/${listAccounts.length}] Claiming ${ACCOUNT_ID}`
            );

            // CALL CONTRACT AND GET THE TX HASH
            const callContract = await wallet.functionCall({
                contractId: "game.hot.tg",
                methodName: "claim",
                args: {},
            });
            const hash = callContract.transaction.hash;

            // Random delay after each claim for each account
            const randomDelayAfterClaim = crypto.randomInt(2, 5); // Random number from 2 to 5 minutes
            console.log(`[${moment().format("HH:mm:ss")}] Random delay after claim for ${randomDelayAfterClaim} minutes`);
            await delay(randomDelayAfterClaim);
        }

        console.log("Accounts processed, waiting for next iteration");

        // Random delay after all claims for all accounts are completed
        const randomDelayBetweenIterations = crypto.randomInt(120, 180); // Random number from 2 to 3 hours
        console.log(`[${moment().format("HH:mm:ss")}] Waiting for ${randomDelayBetweenIterations} minutes before next iteration`);
        await delay(randomDelayBetweenIterations);
        console.log("Waiting done, starting next iteration");
    }
})();
