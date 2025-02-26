
// const express = require("express");
// const http = require("http");
// const FyersSocket = require("fyers-api-v3").fyersDataSocket;
// const cors = require("cors");

// const app = express();
// const server = http.createServer(app);

// app.use(express.json());
// app.use(cors({ origin: '*' }));

// // Initialize Fyers WebSocket
// const fyersdata = new FyersSocket("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuZnllcnMuaW4iLCJpYXQiOjE3NDA0NjAyMDYsImV4cCI6MTc0MDUyOTgwNiwibmJmIjoxNzQwNDYwMjA2LCJhdWQiOlsieDowIiwiZDoxIiwiZDoyIl0sInN1YiI6ImFjY2Vzc190b2tlbiIsImF0X2hhc2giOiJnQUFBQUFCbnZWQ3Vvdl9uREVyT2dfV24tX3RZalA4VEVlRDRJOVJpVE4xcjl1NmZtaTZWY3pVV0RFbEhodUZyclF4clEwVEM0M1NfVUhnb0FtanBINmpJekNCLUFCNzBIWkttSVRmUU1FeHBwbnVHbDNsdFhRbz0iLCJkaXNwbGF5X25hbWUiOiJTQVJUSEFLIFNFTkdBUiIsIm9tcyI6IksxIiwiaHNtX2tleSI6ImUxYjcyZjI4Zjg4MDAxOTMxNGE2YWE4MjdmNDhjMGY0M2ZkY2NkNGFlZjdkZDU4NzRhZTkwMjdkIiwiaXNEZHBpRW5hYmxlZCI6bnVsbCwiaXNNdGZFbmFibGVkIjpudWxsLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsInBvYV9mbGFnIjoiTiJ9.MkUXSFdT4vyFxYGwzBOBPFf4NDZJ38FvDsCBWoYqnOs", "");
// fyersdata.autoreconnect(6);
// fyersdata.connect();

// let userSessions = {}; // Track user subscriptions
// let subscribedSymbols = new Set(); // Track global symbol subscriptions
// let symbolSubscribers = {}; // Track user-wise symbol subscriptions
// let indicesSubscription = new Set();

// // Subscribe to new symbols only if not already subscribed
// function updateSubscription(symbols, userId) {
//     symbols.forEach(symbol => {
//         if (!subscribedSymbols.has(symbol)) {
//             fyersdata.subscribe([symbol]);
//             subscribedSymbols.add(symbol);
//             symbolSubscribers[symbol] = new Set();
//         }
//         symbolSubscribers[symbol].add(userId);
//     });
//     logSubscriptions();
// }

// // Unsubscribe from symbols only if no users need them for any category
// function updateUnsubscription() {
//     for (const symbol of subscribedSymbols) {
//         // Check if any user still needs this symbol in any category
//         const stillNeeded = Object.values(userSessions).some(session =>
//             Object.values(session.categories).some(symbols => symbols.includes(symbol))
//         );

//         if (!stillNeeded) {
//             fyersdata.unsubscribe([symbol]);
//             subscribedSymbols.delete(symbol);
//             delete symbolSubscribers[symbol];
//             console.log(`❌ Unsubscribed from ${symbol}`);
//         }
//     }
//     logSubscriptions();
// }

// // Debugging function for subscriptions
// function logSubscriptions() {
//     console.log("=== Active Subscriptions ===");
//     Object.entries(symbolSubscribers).forEach(([symbol, users]) => {
//         console.log(`📊 Symbol: ${symbol}, Users: ${Array.from(users).join(", ")}`);
//     });
// }

// // Fyers WebSocket event handlers
// fyersdata.on("connect", () => {
//     console.log("✅ Connected to Fyers WebSocket");
//     if (indicesSubscription.size > 0) {
//         fyersdata.subscribe(Array.from(indicesSubscription));
//     }
// });

// fyersdata.on("message", (message) => {
//     if (!message?.symbol || message.ltp === undefined) return;
//     const filteredData = { symbol: message.symbol, ltp: message.ltp, ch: message.ch, chp: message.chp };
//     console.log(`🔔 Received ${message.symbol} data:`, filteredData);
    
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

// // Create API routes dynamically
// ["indices", "watchlist", "positions", "investments", "buy-sell", "options", "option-chain"].forEach(category => {
//     app.post(`/data/${category}`, (req, res) => {
//         const { userId, symbols } = req.body;
//         if (!userId || !Array.isArray(symbols)) return res.status(400).json({ error: "Invalid request" });
        
//         userSessions[userId] = userSessions[userId] || { clients: [], categories: {} };
//         userSessions[userId].categories[category] = symbols;
        
//         if (category === "indices") {
//             symbols.forEach(symbol => indicesSubscription.add(symbol));
//             fyersdata.subscribe(Array.from(indicesSubscription));
//         } else {
//             updateSubscription(symbols, userId);
//         }
        
//         console.log(`👤 User ${userId} subscribed to ${category}:`, symbols);
//         res.json({ message: `${category} data updated successfully` });
//     });
// });

// // Real-time subscription endpoint
// app.get("/subscribe", (req, res) => {
//     const { userId } = req.query;
//     if (!userId || !userSessions[userId]) return res.status(400).json({ error: "Invalid userId" });
    
//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.flushHeaders();
//     res.write(`data: ${JSON.stringify({ message: "Subscribed to live updates" })}\n\n`);
    
//     userSessions[userId].clients.push({ res });
//     req.on("close", () => {
//         userSessions[userId].clients = userSessions[userId].clients.filter(client => client.res !== res);
//         updateUnsubscription();
//     });
//     console.log(`✅ User ${userId} subscribed for real-time updates.`);
// });

// // Unsubscribe user from a specific category only
// app.post("/unsubscribe-category", (req, res) => {
//     const { userId, category } = req.body;
//     if (!userId || !category || !userSessions[userId]) return res.status(400).json({ error: "Invalid request" });

//     if (!userSessions[userId].categories[category]) {
//         return res.json({ message: `User is not subscribed to ${category}` });
//     }

//     // Remove the category for the user
//     delete userSessions[userId].categories[category];

//     // Check if the symbols in this category are still needed by other categories before unsubscribing
//     for (const symbol of Object.keys(symbolSubscribers)) {
//         const stillNeeded = Object.values(userSessions[userId].categories).some(symbols => symbols.includes(symbol));

//         if (!stillNeeded) {
//             symbolSubscribers[symbol].delete(userId);
//             if (symbolSubscribers[symbol].size === 0) delete symbolSubscribers[symbol];
//         }
//     }

//     updateUnsubscription();
//     console.log(`🚫 User ${userId} unsubscribed from ${category}`);
//     res.json({ message: `User unsubscribed from ${category}` });
// });

// // Start server
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

// Initialize Fyers WebSocket
const fyersdata = new FyersSocket("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuZnllcnMuaW4iLCJpYXQiOjE3NDA1NDM0OTgsImV4cCI6MTc0MDYxNjIxOCwibmJmIjoxNzQwNTQzNDk4LCJhdWQiOlsieDowIiwiZDoxIiwiZDoyIl0sInN1YiI6ImFjY2Vzc190b2tlbiIsImF0X2hhc2giOiJnQUFBQUFCbnZwWUtibGJCZHBvdWg4aHppZXd4NlVzNmc5UnRvWTdpT0ZuMlhmMC1va3dMTHpGWnFBSHJ6T1A3SWFlNG0zRlVxeWU2QkdhYXNtekRTRU5iaTA5WU9TTGRDVHlMcV94YmRJQmVZdUk3cEo0SG44UT0iLCJkaXNwbGF5X25hbWUiOiJTQVJUSEFLIFNFTkdBUiIsIm9tcyI6IksxIiwiaHNtX2tleSI6ImUxYjcyZjI4Zjg4MDAxOTMxNGE2YWE4MjdmNDhjMGY0M2ZkY2NkNGFlZjdkZDU4NzRhZTkwMjdkIiwiaXNEZHBpRW5hYmxlZCI6bnVsbCwiaXNNdGZFbmFibGVkIjpudWxsLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsInBvYV9mbGFnIjoiTiJ9.HZsOj1ReUASATXzbMYIY-0MgJcMhWB2jqFZuhQXklA8", "");
fyersdata.autoreconnect(6);
fyersdata.connect();

let userSessions = {}; // Track user subscriptions
let subscribedSymbols = new Set(); // Track global symbol subscriptions
let symbolSubscribers = {}; // Track user-wise symbol subscriptions
let indicesSubscription = new Set();

// Subscribe to new symbols only if not already subscribed
function updateSubscription(symbols, userId) {
    symbols.forEach(symbol => {
        if (!subscribedSymbols.has(symbol)) {
            fyersdata.subscribe([symbol]);
            subscribedSymbols.add(symbol);
            symbolSubscribers[symbol] = new Set();
        }
        symbolSubscribers[symbol].add(userId);
    });
    logSubscriptions();
}

// Unsubscribe from symbols if no users are subscribed
function updateUnsubscription() {
    for (const symbol of subscribedSymbols) {
        if (!symbolSubscribers[symbol] || symbolSubscribers[symbol].size === 0) {
            fyersdata.unsubscribe([symbol]);
            subscribedSymbols.delete(symbol);
            delete symbolSubscribers[symbol];
            console.log(`❌ Unsubscribed from ${symbol}`);
        }
    }
    logSubscriptions();
}

// Debugging function for subscriptions
function logSubscriptions() {
    console.log("=== Active Subscriptions ===");
    Object.entries(symbolSubscribers).forEach(([symbol, users]) => {
        console.log(`📊 Symbol: ${symbol}, Users: ${Array.from(users).join(", ")}`);
    });
}

// Fyers WebSocket event handlers
fyersdata.on("connect", () => {
    console.log("✅ Connected to Fyers WebSocket");
    if (indicesSubscription.size > 0) {
        fyersdata.subscribe(Array.from(indicesSubscription));
    }
});

fyersdata.on("message", (message) => {
    if (!message?.symbol || message.ltp === undefined) return;
    const filteredData = { symbol: message.symbol, ltp: message.ltp, ch: message.ch, chp: message.chp };
    console.log(`🔔 Received ${message.symbol} data:`, filteredData);
    
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

// Create API routes dynamically
["indices", "watchlist", "positions", "investments", "buy-sell", "options", "option-chain"].forEach(category => {
    app.post(`/data/${category}`, (req, res) => {
        const { userId, symbols } = req.body;
        if (!userId || !Array.isArray(symbols)) return res.status(400).json({ error: "Invalid request" });
        
        userSessions[userId] = userSessions[userId] || { clients: [], categories: {} };
        userSessions[userId].categories[category] = symbols;
        
        if (category === "indices") {
            symbols.forEach(symbol => indicesSubscription.add(symbol));
            fyersdata.subscribe(Array.from(indicesSubscription));
        } else {
            updateSubscription(symbols, userId);
        }
        
        console.log(`👤 User ${userId} subscribed to ${category}:`, symbols);
        res.json({ message: `${category} data updated successfully` });
    });
});

// Real-time subscription endpoint
app.get("/subscribe", (req, res) => {
    const { userId } = req.query;
    if (!userId || !userSessions[userId]) return res.status(400).json({ error: "Invalid userId" });
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ message: "Subscribed to live updates" })}\n\n`);
    
    userSessions[userId].clients.push({ res });
    req.on("close", () => {
        userSessions[userId].clients = userSessions[userId].clients.filter(client => client.res !== res);
        updateUnsubscription();
    });
    console.log(`✅ User ${userId} subscribed for real-time updates.`);
});

// Unsubscribe user from a category
app.post("/unsubscribe-category", (req, res) => {
    const { userId, category } = req.body;
    if (!userId || !category || !userSessions[userId]) return res.status(400).json({ error: "Invalid request" });
    
    delete userSessions[userId].categories[category];
    
    for (const symbol of Object.keys(symbolSubscribers)) {
        symbolSubscribers[symbol].delete(userId);
        if (symbolSubscribers[symbol].size === 0) delete symbolSubscribers[symbol];
    }
    updateUnsubscription();
    console.log(`🚫 User ${userId} unsubscribed from ${category}`);
    res.json({ message: `User unsubscribed from ${category}` });
});

// Start server
const PORT = process.env.PORT || 7000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
