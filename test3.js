// const express = require("express");
// const http = require("http");
// const FyersSocket = require("fyers-api-v3").fyersDataSocket;
// const cors = require("cors");

// const app = express();
// const server = http.createServer(app);

// app.use(express.json());
// app.use(cors({ origin: '*' }));

// console.log("🚀 Initializing Fyers WebSocket connection...");
// const fyersdata = new FyersSocket("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiZDoxIiwiZDoyIiwieDowIl0sImF0X2hhc2giOiJnQUFBQUFCbjVORjViQTlkcnlpY3A5ZUtXSlkyYnQ1Qy1ndU1Ea09zUk9VX0hGRlJZcmoyVnJ5RkY0bjlxV3BIY0lOZjNkTEJhV3ctcXRpanBMOE5wMUZtY1lUNlRUblBlblVQcEpHQ1VBSFZtTEVjdVJ5VXVkVT0iLCJkaXNwbGF5X25hbWUiOiIiLCJvbXMiOiJLMSIsImhzbV9rZXkiOiJlMWI3MmYyOGY4ODAwMTkzMTRhNmFhODI3ZjQ4YzBmNDNmZGNjZDRhZWY3ZGQ1ODc0YWU5MDI3ZCIsImlzRGRwaUVuYWJsZWQiOiIiLCJpc010ZkVuYWJsZWQiOiIiLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsImV4cCI6MTc0MzEyMTgwMCwiaWF0IjoxNzQzMDQ5MDgxLCJpc3MiOiJhcGkuZnllcnMuaW4iLCJuYmYiOjE3NDMwNDkwODEsInN1YiI6ImFjY2Vzc190b2tlbiJ9.rwoKevSB3EqYuEkbwhQhN6i8_ozpcskeKr1MoJXS4ms", "");
// fyersdata.autoreconnect(6);
// fyersdata.connect();

// let userSessions = {}; 
// let subscribedSymbols = new Set();
// let symbolSubscribers = {}; 
// let lastKnownData = {}; 

// function updateSubscription(symbols, userId) {
//     console.log(`🔄 Updating subscription for user ${userId}:`, symbols);
//     symbols.forEach(symbol => {
//         if (!symbolSubscribers[symbol]) {
//             symbolSubscribers[symbol] = new Set();
//         }
//         symbolSubscribers[symbol].add(userId);

//         if (!subscribedSymbols.has(symbol)) {
//             console.log(`📡 Subscribing to symbol: ${symbol}`);
//             fyersdata.subscribe([symbol]);
//             subscribedSymbols.add(symbol);
//         }
//     });
//     logSubscriptions();
// }

// async function updateUnsubscription(symbolsToUnsubscribe) {
//     symbolsToUnsubscribe.forEach(async (symbol) => {
//         if (subscribedSymbols.has(symbol)) {
//             await fyersdata.unsubscribe([symbol]); 
//             subscribedSymbols.delete(symbol);
//             delete symbolSubscribers[symbol];
//             delete lastKnownData[symbol];
//             console.log(`🚨 Unsubscribed from ${symbol} and removed it from Fyers stream`);
//         }
//     });
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
// });

// fyersdata.on("message", (message) => {
//     console.log("📩 Incoming WebSocket Message:", message);
//     if (!message?.symbol || message.ltp === undefined) return;
    
//     const filteredData = { symbol: message.symbol, ltp: message.ltp, ch: message.ch, chp: message.chp };
//     lastKnownData[message.symbol] = filteredData;

//     Object.entries(userSessions).forEach(([userId, session]) => {
//         Object.entries(session.categories || {}).forEach(([category, symbols]) => {
//             if (symbols.includes(message.symbol)) {
//                 console.log(`📤 Sending update to user ${userId} for category ${category}`);
//                 session.clients.forEach(client => {
//                     client.res.write(`data: ${JSON.stringify({ category, ...filteredData })}\n\n`);
//                 });
//             }
//         });
//     });
// });

// app.post("/data/:category", (req, res) => {
//     console.log("🔹 Received data subscription request:", req.body);
//     const { userId, symbols } = req.body;
//     const category = req.params.category;
//     if (!userId || !Array.isArray(symbols)) return res.status(400).json({ error: "Invalid request" });
    
//     userSessions[userId] = userSessions[userId] || { clients: [], categories: {} };
//     userSessions[userId].categories[category] = symbols;
//     updateSubscription(symbols, userId);
    
//     res.json({ message: `${category} data updated successfully` });
// });

// app.get("/subscribe", (req, res) => {
//     console.log("🔹 Received new subscription request:", req.query);
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
//         console.log(`❌ User ${userId} disconnected from real-time updates.`);
//         userSessions[userId].clients = userSessions[userId].clients.filter(client => client.res !== res);
//         if (userSessions[userId].clients.length === 0 && Object.keys(userSessions[userId].categories).length === 0) {
//             delete userSessions[userId];
//         }
//         updateUnsubscription();
//     });
//     console.log(`✅ User ${userId} subscribed for real-time updates.`);
// });

// app.post("/unsubscribe-category", async (req, res) => {
//     try {
//         const { userId, category } = req.body;
//         if (!userId || !category || !userSessions[userId]) {
//             return res.status(400).json({ error: "Invalid request" });
//         }
        
//         const removedSymbols = userSessions[userId].categories[category] || [];
//         delete userSessions[userId].categories[category];

//         await updateUnsubscription(removedSymbols);  // Unsubscribe symbols from Fyers immediately

//         res.json({ message: `User unsubscribed from ${category} and symbols removed` });
//     } catch (error) {
//         console.error("🚨 Error in /unsubscribe-category:", error);
//         res.status(500).json({ error: "Internal server error" });
//     }
// });


// const PORT = process.env.PORT || 7000;
// server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
















// const express = require("express");
// const http = require("http");
// const FyersSocket = require("fyers-api-v3").fyersDataSocket;
// const cors = require("cors");

// const app = express();
// const server = http.createServer(app);

// app.use(express.json());
// app.use(cors({ origin: '*' }));

// const fyersdata = new FyersSocket("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiZDoxIiwiZDoyIiwieDowIl0sImF0X2hhc2giOiJnQUFBQUFCbjVORjViQTlkcnlpY3A5ZUtXSlkyYnQ1Qy1ndU1Ea09zUk9VX0hGRlJZcmoyVnJ5RkY0bjlxV3BIY0lOZjNkTEJhV3ctcXRpanBMOE5wMUZtY1lUNlRUblBlblVQcEpHQ1VBSFZtTEVjdVJ5VXVkVT0iLCJkaXNwbGF5X25hbWUiOiIiLCJvbXMiOiJLMSIsImhzbV9rZXkiOiJlMWI3MmYyOGY4ODAwMTkzMTRhNmFhODI3ZjQ4YzBmNDNmZGNjZDRhZWY3ZGQ1ODc0YWU5MDI3ZCIsImlzRGRwaUVuYWJsZWQiOiIiLCJpc010ZkVuYWJsZWQiOiIiLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsImV4cCI6MTc0MzEyMTgwMCwiaWF0IjoxNzQzMDQ5MDgxLCJpc3MiOiJhcGkuZnllcnMuaW4iLCJuYmYiOjE3NDMwNDkwODEsInN1YiI6ImFjY2Vzc190b2tlbiJ9.rwoKevSB3EqYuEkbwhQhN6i8_ozpcskeKr1MoJXS4ms", "");
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



const express = require("express");
const http = require("http");
const FyersSocket = require("fyers-api-v3").fyersDataSocket;
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors({ origin: '*' }));

const fyersdata = new FyersSocket("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiZDoxIiwiZDoyIiwieDowIl0sImF0X2hhc2giOiJnQUFBQUFCbjVoOWE3Nlk4aXRYWHpjQ0I4ZjNkbkg4NFVHUHJZa0gwcEQ4NlhLSVRxYmJfZ3JFRV9DTjNndGIwZFpMVC1nWjVwd0ZpTjRkRDBKaHU5TkpBTFBlczVLcGh0eG5RUE5YRmo4U1E2ZG5SQXBtczJIdz0iLCJkaXNwbGF5X25hbWUiOiIiLCJvbXMiOiJLMSIsImhzbV9rZXkiOiJlMWI3MmYyOGY4ODAwMTkzMTRhNmFhODI3ZjQ4YzBmNDNmZGNjZDRhZWY3ZGQ1ODc0YWU5MDI3ZCIsImlzRGRwaUVuYWJsZWQiOiIiLCJpc010ZkVuYWJsZWQiOiIiLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsImV4cCI6MTc0MzIwODIwMCwiaWF0IjoxNzQzMTM0NTU0LCJpc3MiOiJhcGkuZnllcnMuaW4iLCJuYmYiOjE3NDMxMzQ1NTQsInN1YiI6ImFjY2Vzc190b2tlbiJ9.lcuoYjfTWvsTbny9ZJ98wCHVbcG0eShJnKzgDArmq4Y", "");
fyersdata.autoreconnect(6);
fyersdata.connect();

let userSessions = {};
let subscribedSymbols = new Set();
let symbolSubscribers = {};
let indicesSubscription = new Set();
let lastKnownData = {}; 
let symbolTimers = {}; 
let resubscriptionCounts = {}; 
const MAX_RESUBSCRIPTIONS = 2;

function updateSubscription(symbols, userId, category) {
    symbols.forEach(symbol => {
        if (!symbolSubscribers[symbol]) {
            symbolSubscribers[symbol] = new Set();
        }
        symbolSubscribers[symbol].add(userId);
        
        if (!subscribedSymbols.has(symbol)) {
            fyersdata.subscribe([symbol]);
            subscribedSymbols.add(symbol);
            console.log(`✅ User ${userId} subscribed to ${category} - Symbol: ${symbol}`);
            resubscriptionCounts[symbol] = 0;
            startSymbolTimer(symbol);
        }
    });
    logSubscriptions();
}

function updateUnsubscription() {
    for (const symbol of subscribedSymbols) {
        const stillNeeded = Object.values(userSessions).some(session =>
            Object.values(session.categories).some(symbols => symbols.includes(symbol))
        );
        if (!stillNeeded) {
            fyersdata.unsubscribe([symbol]);
            subscribedSymbols.delete(symbol);
            delete symbolSubscribers[symbol];
            delete resubscriptionCounts[symbol];
            console.log(`❌ Symbol ${symbol} unsubscribed due to no active users.`);
        }
    }
    logSubscriptions();
}

function logSubscriptions() {
    console.log("=== Active Subscriptions ===");
    Object.entries(symbolSubscribers).forEach(([symbol, users]) => {
        console.log(`📊 Symbol: ${symbol}, Users: ${Array.from(users).join(", ")}`);
    });
}

function startSymbolTimer(symbol) {
    if (symbolTimers[symbol]) clearTimeout(symbolTimers[symbol]);
    symbolTimers[symbol] = setTimeout(() => {
        if (resubscriptionCounts[symbol] < MAX_RESUBSCRIPTIONS && subscribedSymbols.has(symbol)) {
            console.log(`🔄 Re-subscribing to ${symbol} due to inactivity...`);
            fyersdata.subscribe([symbol]);
            resubscriptionCounts[symbol]++;
        }
    }, 10000); 
}

fyersdata.on("connect", () => {
    console.log("✅ Connected to Fyers WebSocket");
    if (indicesSubscription.size > 0) {
        fyersdata.subscribe(Array.from(indicesSubscription));
    }
});

fyersdata.on("message", (message) => {
    if (!message?.symbol || message.ltp === undefined) return;
    const filteredData = { symbol: message.symbol, ltp: message.ltp, ch: message.ch, chp: message.chp };
    lastKnownData[message.symbol] = filteredData;
    // console.log(`📊 Received Data:`, filteredData);
    clearTimeout(symbolTimers[message.symbol]); 
    startSymbolTimer(message.symbol);
    
    Object.entries(userSessions).forEach(([userId, session]) => {
        Object.entries(session.categories || {}).forEach(([category, symbols]) => {
            if (symbols.includes(message.symbol)) {
                session.clients.forEach(client => {
                    client.res.write(`data: ${JSON.stringify({ category, ...filteredData })}\n\n`);
                });
            }
        });
    });
});

app.post("/data/:category", (req, res) => {
    const { userId, symbols } = req.body;
    const category = req.params.category;
    if (!userId || !Array.isArray(symbols)) return res.status(400).json({ error: "Invalid request" });
    
    userSessions[userId] = userSessions[userId] || { clients: [], categories: {} };
    userSessions[userId].categories[category] = symbols;
    
    if (category === "indices") {
        symbols.forEach(symbol => indicesSubscription.add(symbol));
        fyersdata.subscribe(Array.from(indicesSubscription));
    } else {
        updateSubscription(symbols, userId, category);
    }
    
    res.json({ message: `${category} data updated successfully` });
});

app.get("/subscribe", (req, res) => {
    const { userId } = req.query;
    if (!userId || !userSessions[userId]) return res.status(400).json({ error: "Invalid userId" });
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ message: "Subscribed to live updates" })}\n\n`);
    
    userSessions[userId].clients.push({ res });
    
    Object.entries(userSessions[userId].categories || {}).forEach(([category, symbols]) => {
        symbols.forEach(symbol => {
            if (lastKnownData[symbol]) {
                res.write(`data: ${JSON.stringify({ category, ...lastKnownData[symbol] })}\n\n`);
            }
        });
    });
    
    req.on("close", () => {
        userSessions[userId].clients = userSessions[userId].clients.filter(client => client.res !== res);
        updateUnsubscription();
    });
    console.log(`✅ User ${userId} subscribed for real-time updates.`);
});

app.post("/unsubscribe-category", (req, res) => {
    const { userId, category } = req.body;
    if (!userId || !category || !userSessions[userId]) return res.status(400).json({ error: "Invalid request" });

    if (!userSessions[userId].categories[category]) {
        return res.json({ message: `User is not subscribed to ${category}` });
    }
    
    delete userSessions[userId].categories[category];
    console.log(`❌ User ${userId} unsubscribed from category ${category}`);
    
    updateUnsubscription();
    res.json({ message: `User unsubscribed from ${category}` });
});

const PORT = process.env.PORT || 7000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
