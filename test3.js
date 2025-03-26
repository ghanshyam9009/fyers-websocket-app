const express = require("express");
const http = require("http");
const FyersSocket = require("fyers-api-v3").fyersDataSocket;
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors({ origin: '*' }));

const fyersdata = new FyersSocket("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuZnllcnMuaW4iLCJpYXQiOjE3NDI5NjM5MzQsImV4cCI6MTc0MzAzNTQ1NCwibmJmIjoxNzQyOTYzOTM0LCJhdWQiOlsieDowIiwiZDoxIiwiZDoyIl0sInN1YiI6ImFjY2Vzc190b2tlbiIsImF0X2hhc2giOiJnQUFBQUFCbjQ0VGV3WFRoTC1vRk4xMWVtdE5lU2FVSDI2UnlPV2JDNWZUNXQ3cU9DbjhlbUotR3kxWHJlUVA4TUhxNU1wQnZLQTVFNFA4ZEQwaFI5aTVoeVdZTHdoYUxEaUZzMnV4MFNlRkpFcVRtX3NoLVFCST0iLCJkaXNwbGF5X25hbWUiOiJTQVJUSEFLIFNFTkdBUiIsIm9tcyI6IksxIiwiaHNtX2tleSI6ImUxYjcyZjI4Zjg4MDAxOTMxNGE2YWE4MjdmNDhjMGY0M2ZkY2NkNGFlZjdkZDU4NzRhZTkwMjdkIiwiaXNEZHBpRW5hYmxlZCI6bnVsbCwiaXNNdGZFbmFibGVkIjpudWxsLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsInBvYV9mbGFnIjoiTiJ9.mX71aWCj15R0WaWbObn3uIdPwDiUdrqYbkROFu7v6e8", "");
fyersdata.autoreconnect(6); 
fyersdata.connect();

let userSessions = new Map(); // Store user sessions
let activeSubscriptions = new Map(); // Track symbols and their subscribers
let lastKnownData = new Map(); // Store last received data
let queue = []; // Async processing queue
let isProcessing = false;

// Function to process queued actions
async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;
    while (queue.length > 0) {
        const task = queue.shift();
        try {
            await task();
        } catch (error) {
            console.error("❌ Queue Task Error:", error);
        }
    }
    isProcessing = false;
}

// Subscription handling
async function subscribeUserToSymbols(userId, symbols) {
    queue.push(async () => {
        if (!userSessions.has(userId)) {
            userSessions.set(userId, { clients: new Set(), symbols: new Set() });
        }

        const userSession = userSessions.get(userId);
        symbols.forEach(symbol => {
            userSession.symbols.add(symbol);
            
            if (!activeSubscriptions.has(symbol)) {
                activeSubscriptions.set(symbol, new Set());
                fyersdata.subscribe([symbol]);
                console.log(`📌 Subscribed to ${symbol}`);
            }

            activeSubscriptions.get(symbol).add(userId);
        });

        console.log(`✅ Updated subscriptions for user ${userId}: ${Array.from(userSession.symbols).join(", ")}`);
    });

    processQueue();
}

// Unsubscription handling
async function unsubscribeUserFromSymbols(userId, symbols) {
    queue.push(async () => {
        if (!userSessions.has(userId)) return;

        const userSession = userSessions.get(userId);
        symbols.forEach(symbol => {
            userSession.symbols.delete(symbol);

            if (activeSubscriptions.has(symbol)) {
                activeSubscriptions.get(symbol).delete(userId);
                if (activeSubscriptions.get(symbol).size === 0) {
                    activeSubscriptions.delete(symbol);
                    fyersdata.unsubscribe([symbol]);
                    console.log(`❌ Unsubscribed from ${symbol}`);
                }
            }
        });

        console.log(`🚫 User ${userId} unsubscribed from: ${symbols.join(", ")}`);

        if (userSession.symbols.size === 0) {
            userSessions.delete(userId);
        }
    });

    processQueue();
}

// WebSocket event handling
fyersdata.on("connect", () => {
    console.log("✅ Connected to Fyers WebSocket");
    if (activeSubscriptions.size > 0) {
        fyersdata.subscribe(Array.from(activeSubscriptions.keys()));
    }
});

fyersdata.on("message", (message) => {
    if (!message?.symbol || message.ltp === undefined) return;

    const filteredData = { 
        symbol: message.symbol, 
        ltp: message.ltp, 
        ch: message.ch, 
        chp: message.chp 
    };

    lastKnownData.set(message.symbol, filteredData);
    console.log(`📊 Received Data:`, filteredData);

    if (activeSubscriptions.has(message.symbol)) {
        activeSubscriptions.get(message.symbol).forEach(userId => {
            if (userSessions.has(userId)) {
                userSessions.get(userId).clients.forEach(client => {
                    client.res.write(`data: ${JSON.stringify(filteredData)}\n\n`);
                    client.res.flushHeaders();  // Ensures immediate delivery
                });
            }
        });
    }
});


// Subscription API
app.post("/data/:category", async (req, res) => {
    const { userId, symbols } = req.body;
    const category = req.params.category;
    
    if (!userId || !Array.isArray(symbols)) {
        return res.status(400).json({ error: "Invalid request" });
    }

    await subscribeUserToSymbols(userId, symbols);
    res.json({ message: `${category} data updated successfully` });
});

// Unsubscription API
app.post("/unsubscribe", async (req, res) => {
    const { userId, symbols } = req.body;

    if (!userId || !Array.isArray(symbols)) {
        return res.status(400).json({ error: "Invalid request" });
    }

    await unsubscribeUserFromSymbols(userId, symbols);
    res.json({ message: `Unsubscribed successfully` });
});

// Real-time data stream API
// app.get("/subscribe", (req, res) => {
//     const { userId } = req.query;
//     if (!userId) return res.status(400).json({ error: "Invalid userId" });

//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.flushHeaders();
//     res.write(`data: ${JSON.stringify({ message: "Subscribed to live updates" })}\n\n`);

//     if (!userSessions.has(userId)) {
//         userSessions.set(userId, { clients: new Set(), symbols: new Set() });
//     }
    
//     userSessions.get(userId).clients.add({ res });

//     userSessions.get(userId).symbols.forEach(symbol => {
//         if (lastKnownData.has(symbol)) {
//             res.write(`data: ${JSON.stringify(lastKnownData.get(symbol))}\n\n`);
//         }
//     });

//     req.on("close", () => {
//         userSessions.get(userId).clients.delete({ res });
//         console.log(`🔴 User ${userId} disconnected.`);
//     });

//     console.log(`✅ User ${userId} subscribed for real-time updates.`);
// });

app.get("/subscribe", (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Invalid userId" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ message: "Subscribed to live updates" })}\n\n`);

    if (!userSessions.has(userId)) {
        userSessions.set(userId, { clients: new Set(), symbols: new Set() });
    }

    // Store the response object correctly
    const client = { res };
    userSessions.get(userId).clients.add(client);

    // Send last known data for each symbol
    userSessions.get(userId).symbols.forEach(symbol => {
        if (lastKnownData.has(symbol)) {
            res.write(`data: ${JSON.stringify(lastKnownData.get(symbol))}\n\n`);
        }
    });

    // Handle client disconnect
    req.on("close", () => {
        const userSession = userSessions.get(userId);
        if (userSession) {
            userSession.clients.delete(client);
            if (userSession.clients.size === 0) {
                userSessions.delete(userId);
            }
        }
        console.log(`🔴 User ${userId} disconnected.`);
    });

    console.log(`✅ User ${userId} subscribed for real-time updates.`);
});


// Server start
const PORT = process.env.PORT || 7000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));





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
// let pendingSubscriptions = new Map(); // Track pending re-subscriptions

// function updateSubscription(symbols, userId) {
//     symbols.forEach(symbol => {
//         if (!symbolSubscribers[symbol]) {
//             symbolSubscribers[symbol] = new Set();
//         }
//         symbolSubscribers[symbol].add(userId);
        
//         if (!subscribedSymbols.has(symbol)) {
//             fyersdata.subscribe([symbol]);
//             subscribedSymbols.add(symbol);
//         } else if (pendingSubscriptions.has(symbol)) {
//             // If symbol was previously unsubscribed but still needed, re-subscribe it
//             fyersdata.subscribe([symbol]);
//             pendingSubscriptions.delete(symbol);
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
//             pendingSubscriptions.set(symbol, true); // Mark for potential re-subscription
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
//     if (!message?.symbol || message.ltp === undefined) return;
//     const filteredData = { symbol: message.symbol, ltp: message.ltp, ch: message.ch, chp: message.chp };
//     lastKnownData[message.symbol] = filteredData;

//         console.log(`📊 Received Data:`, { ...filteredData, ltp: message.ltp });

    
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
    
//     if (category === "indices") {
//         symbols.forEach(symbol => indicesSubscription.add(symbol));
//         fyersdata.subscribe(Array.from(indicesSubscription));
//     } else {
//         updateSubscription(symbols, userId);
//     }
    
//     res.json({ message: `${category} data updated successfully` });
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
//             }
//         });
//     });
    
//     req.on("close", () => {
//         userSessions[userId].clients = userSessions[userId].clients.filter(client => client.res !== res);
//         updateUnsubscription();
//     });
//     console.log(`✅ User ${userId} subscribed for real-time updates.`);
// });

// app.post("/unsubscribe-category", (req, res) => {
//     const { userId, category } = req.body;
//     if (!userId || !category || !userSessions[userId]) return res.status(400).json({ error: "Invalid request" });

//     if (!userSessions[userId].categories[category]) {
//         return res.json({ message: `User is not subscribed to ${category}` });
//     }
    
//     delete userSessions[userId].categories[category];
    
//     for (const symbol of Object.keys(symbolSubscribers)) {
//         const stillNeeded = Object.values(userSessions).some(session =>
//             Object.values(session.categories).some(symbols => symbols.includes(symbol))
//         );
//         if (!stillNeeded) {
//             symbolSubscribers[symbol].delete(userId);
//             if (symbolSubscribers[symbol].size === 0) delete symbolSubscribers[symbol];
//         }
//     }
    
//     updateUnsubscription();
//     res.json({ message: `User unsubscribed from ${category}` });
// });

// const PORT = process.env.PORT || 7000;
// server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));





