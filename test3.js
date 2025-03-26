// const express = require("express");
// const http = require("http");
// const FyersSocket = require("fyers-api-v3").fyersDataSocket;
// const cors = require("cors");

// const app = express();
// const server = http.createServer(app);

// app.use(express.json());
// app.use(cors({ origin: '*' }));

// const fyersdata = new FyersSocket("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuZnllcnMuaW4iLCJpYXQiOjE3NDI5NjM5MzQsImV4cCI6MTc0MzAzNTQ1NCwibmJmIjoxNzQyOTYzOTM0LCJhdWQiOlsieDowIiwiZDoxIiwiZDoyIl0sInN1YiI6ImFjY2Vzc190b2tlbiIsImF0X2hhc2giOiJnQUFBQUFCbjQ0VGV3WFRoTC1vRk4xMWVtdE5lU2FVSDI2UnlPV2JDNWZUNXQ3cU9DbjhlbUotR3kxWHJlUVA4TUhxNU1wQnZLQTVFNFA4ZEQwaFI5aTVoeVdZTHdoYUxEaUZzMnV4MFNlRkpFcVRtX3NoLVFCST0iLCJkaXNwbGF5X25hbWUiOiJTQVJUSEFLIFNFTkdBUiIsIm9tcyI6IksxIiwiaHNtX2tleSI6ImUxYjcyZjI4Zjg4MDAxOTMxNGE2YWE4MjdmNDhjMGY0M2ZkY2NkNGFlZjdkZDU4NzRhZTkwMjdkIiwiaXNEZHBpRW5hYmxlZCI6bnVsbCwiaXNNdGZFbmFibGVkIjpudWxsLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsInBvYV9mbGFnIjoiTiJ9.mX71aWCj15R0WaWbObn3uIdPwDiUdrqYbkROFu7v6e8", "");
// fyersdata.autoreconnect(6);
// fyersdata.connect();

// let userSessions = {};
// let subscribedSymbols = new Set();
// let symbolSubscribers = {};
// let indicesSubscription = new Set();
// let lastKnownData = {}; // Store last known data
// let failedSymbols = new Set(); // Track symbols that failed to receive data

// function updateSubscription(symbols, userId) {
//     symbols.forEach(symbol => {
//         if (!symbolSubscribers[symbol]) {
//             symbolSubscribers[symbol] = new Set();
//         }
//         symbolSubscribers[symbol].add(userId);

//         if (!subscribedSymbols.has(symbol) && !failedSymbols.has(symbol)) {
//             fyersdata.subscribe([symbol]);
//             subscribedSymbols.add(symbol);
//         }
//     });
//     logSubscriptions();
// }

// function updateUnsubscription() {
//     for (const symbol of subscribedSymbols) {
//         const stillNeeded = Object.values(userSessions).some(session =>
//             Object.values(session.categories).some(symbols => symbols.includes(symbol))
//         );
//         if (!stillNeeded) {
//             fyersdata.unsubscribe([symbol]);
//             subscribedSymbols.delete(symbol);
//             failedSymbols.delete(symbol); // Clear from failed symbols when unsubscribed
//             delete symbolSubscribers[symbol];
//         }
//     }
//     logSubscriptions();
// }

// function logSubscriptions() {
//     console.log("=== Active Subscriptions ===");
//     Object.entries(symbolSubscribers).forEach(([symbol, users]) => {
//         console.log(`📊 Symbol: ${symbol}, Users: ${Array.from(users).join(", ")}`);
//     });
// }

// fyersdata.on("connect", () => {
//     console.log("✅ Connected to Fyers WebSocket");
//     if (indicesSubscription.size > 0) {
//         fyersdata.subscribe(Array.from(indicesSubscription));
//     }
// });

// fyersdata.on("message", (message) => {
//     if (!message?.symbol || message.ltp === undefined) {
//         failedSymbols.add(message?.symbol);
//         return;
//     }
    
//     const filteredData = { symbol: message.symbol, ltp: message.ltp, ch: message.ch, chp: message.chp };
//     lastKnownData[message.symbol] = filteredData;
//     failedSymbols.delete(message.symbol);

//     console.log(`📊 Received Data:`, filteredData);
    
//     Object.entries(userSessions).forEach(([userId, session]) => {
//         Object.entries(session.categories || {}).forEach(([category, symbols]) => {
//             if (symbols.includes(message.symbol)) {
//                 session.clients.forEach(client => {
//                     client.res.write(`data: ${JSON.stringify({ category, ...filteredData })}\n\n`);
//                 });
//             }
//         });
//     });
// });

// app.post("/data/:category", (req, res) => {
//     const { userId, symbols } = req.body;
//     const category = req.params.category;
//     if (!userId || !Array.isArray(symbols)) return res.status(400).json({ error: "Invalid request" });
    
//     userSessions[userId] = userSessions[userId] || { clients: [], categories: {} };
//     userSessions[userId].categories[category] = symbols;
    
//     updateSubscription(symbols, userId);
//     res.json({ message: `${category} data updated successfully`, failedSymbols: Array.from(failedSymbols) });
// });

// app.get("/subscribe", (req, res) => {
//     const { userId } = req.query;
//     if (!userId || !userSessions[userId]) return res.status(400).json({ error: "Invalid userId" });
    
//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.flushHeaders();
//     res.write(`data: ${JSON.stringify({ message: "Subscribed to live updates" })}\n\n`);
    
//     userSessions[userId].clients.push({ res });
    
//     Object.entries(userSessions[userId].categories || {}).forEach(([category, symbols]) => {
//         symbols.forEach(symbol => {
//             if (lastKnownData[symbol]) {
//                 res.write(`data: ${JSON.stringify({ category, ...lastKnownData[symbol] })}\n\n`);
//             } else if (failedSymbols.has(symbol)) {
//                 res.write(`data: ${JSON.stringify({ category, symbol, error: "Data unavailable" })}\n\n`);
//             }
//         });
//     });
    
//     req.on("close", () => {
//         userSessions[userId].clients = userSessions[userId].clients.filter(client => client.res !== res);
//         updateUnsubscription();
//     });
//     console.log(`✅ User ${userId} subscribed for real-time updates.`);
// });

// const PORT = process.env.PORT || 7000;
// server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));


const express = require("express");
const http = require("http");
const FyersSocket = require("fyers-api-v3").fyersDataSocket;
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors({ origin: "*" }));

const fyersdata = new FyersSocket("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuZnllcnMuaW4iLCJpYXQiOjE3NDI5NjM5MzQsImV4cCI6MTc0MzAzNTQ1NCwibmJmIjoxNzQyOTYzOTM0LCJhdWQiOlsieDowIiwiZDoxIiwiZDoyIl0sInN1YiI6ImFjY2Vzc190b2tlbiIsImF0X2hhc2giOiJnQUFBQUFCbjQ0VGV3WFRoTC1vRk4xMWVtdE5lU2FVSDI2UnlPV2JDNWZUNXQ3cU9DbjhlbUotR3kxWHJlUVA4TUhxNU1wQnZLQTVFNFA4ZEQwaFI5aTVoeVdZTHdoYUxEaUZzMnV4MFNlRkpFcVRtX3NoLVFCST0iLCJkaXNwbGF5X25hbWUiOiJTQVJUSEFLIFNFTkdBUiIsIm9tcyI6IksxIiwiaHNtX2tleSI6ImUxYjcyZjI4Zjg4MDAxOTMxNGE2YWE4MjdmNDhjMGY0M2ZkY2NkNGFlZjdkZDU4NzRhZTkwMjdkIiwiaXNEZHBpRW5hYmxlZCI6bnVsbCwiaXNNdGZFbmFibGVkIjpudWxsLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsInBvYV9mbGFnIjoiTiJ9.mX71aWCj15R0WaWbObn3uIdPwDiUdrqYbkROFu7v6e8", "");
fyersdata.autoreconnect(6);
fyersdata.connect();

let userSessions = {};
let subscribedSymbols = new Set();
let symbolSubscribers = {};
let lastKnownData = {};
let failedSymbols = new Set();
let subscriptionQueue = []; // Queue for managing subscriptions
let processingQueue = false; // Flag to avoid race conditions

async function processQueue() {
    if (processingQueue) return;
    processingQueue = true;

    while (subscriptionQueue.length > 0) {
        const { type, symbols, userId } = subscriptionQueue.shift();

        if (type === "subscribe") {
            symbols.forEach((symbol) => {
                if (!symbolSubscribers[symbol]) {
                    symbolSubscribers[symbol] = new Set();
                }
                symbolSubscribers[symbol].add(userId);

                if (!subscribedSymbols.has(symbol) && !failedSymbols.has(symbol)) {
                    fyersdata.subscribe([symbol]);
                    subscribedSymbols.add(symbol);
                }
            });
        } else if (type === "unsubscribe") {
            for (const symbol of symbols) {
                if (symbolSubscribers[symbol]) {
                    symbolSubscribers[symbol].delete(userId);
                    if (symbolSubscribers[symbol].size === 0) {
                        fyersdata.unsubscribe([symbol]);
                        subscribedSymbols.delete(symbol);
                        failedSymbols.delete(symbol);
                        delete symbolSubscribers[symbol];
                    }
                }
            }
        }
        logSubscriptions();
        await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay to avoid API overload
    }

    processingQueue = false;
}

function queueSubscription(type, symbols, userId) {
    subscriptionQueue.push({ type, symbols, userId });
    processQueue();
}

function logSubscriptions() {
    console.log("=== Active Subscriptions ===");
    Object.entries(symbolSubscribers).forEach(([symbol, users]) => {
        console.log(`📊 Symbol: ${symbol}, Users: ${Array.from(users).join(", ")}`);
    });
}

fyersdata.on("connect", () => {
    console.log("✅ Connected to Fyers WebSocket");
});

fyersdata.on("message", (message) => {
    if (!message?.symbol || message.ltp === undefined) {
        failedSymbols.add(message?.symbol);
        return;
    }

    const filteredData = {
        symbol: message.symbol,
        ltp: message.ltp,
        ch: message.ch,
        chp: message.chp,
    };
    lastKnownData[message.symbol] = filteredData;
    failedSymbols.delete(message.symbol);

    console.log(`📊 Received Data:`, filteredData);

    Object.entries(userSessions).forEach(([userId, session]) => {
        Object.entries(session.categories || {}).forEach(([category, symbols]) => {
            if (symbols.includes(message.symbol)) {
                session.clients.forEach((client) => {
                    client.res.write(
                        `data: ${JSON.stringify({ category, ...filteredData })}\n\n`
                    );
                });
            }
        });
    });
});

app.post("/data/:category", (req, res) => {
    const { userId, symbols } = req.body;
    const category = req.params.category;
    if (!userId || !Array.isArray(symbols))
        return res.status(400).json({ error: "Invalid request" });

    userSessions[userId] = userSessions[userId] || {
        clients: [],
        categories: {},
    };
    userSessions[userId].categories[category] = symbols;

    queueSubscription("subscribe", symbols, userId);
    res.json({
        message: `${category} data updated successfully`,
        failedSymbols: Array.from(failedSymbols),
    });
});

app.get("/subscribe", (req, res) => {
    const { userId } = req.query;
    if (!userId || !userSessions[userId])
        return res.status(400).json({ error: "Invalid userId" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(
        `data: ${JSON.stringify({
            message: "Subscribed to live updates",
        })}\n\n`
    );

    userSessions[userId].clients.push({ res });

    Object.entries(userSessions[userId].categories || {}).forEach(
        ([category, symbols]) => {
            symbols.forEach((symbol) => {
                if (lastKnownData[symbol]) {
                    res.write(
                        `data: ${JSON.stringify({
                            category,
                            ...lastKnownData[symbol],
                        })}\n\n`
                    );
                } else if (failedSymbols.has(symbol)) {
                    res.write(
                        `data: ${JSON.stringify({
                            category,
                            symbol,
                            error: "Data unavailable",
                        })}\n\n`
                    );
                }
            });
        }
    );

    req.on("close", () => {
        userSessions[userId].clients = userSessions[userId].clients.filter(
            (client) => client.res !== res
        );

        const symbolsToUnsubscribe = [];
        Object.entries(userSessions[userId].categories || {}).forEach(
            ([, symbols]) => {
                symbolsToUnsubscribe.push(...symbols);
            }
        );
        delete userSessions[userId];

        queueSubscription("unsubscribe", symbolsToUnsubscribe, userId);
    });
    console.log(`✅ User ${userId} subscribed for real-time updates.`);
});

const PORT = process.env.PORT || 7000;
server.listen(PORT, () =>
    console.log(`✅ Server running on port ${PORT}`)
);

