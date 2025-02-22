
// const express = require("express");
// const http = require("http");
// const FyersSocket = require("fyers-api-v3").fyersDataSocket;
// const app = express();
// const cors = require("cors");

// app.use(express.json());

// const server = http.createServer(app);
// app.use(cors({ origin: '*' }));

// // Initialize Fyers WebSocket
// const fyersdata = new FyersSocket("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuZnllcnMuaW4iLCJpYXQiOjE3NDAwMzEzOTksImV4cCI6MTc0MDA5NzgxOSwibmJmIjoxNzQwMDMxMzk5LCJhdWQiOlsieDowIiwiZDoxIiwiZDoyIl0sInN1YiI6ImFjY2Vzc190b2tlbiIsImF0X2hhc2giOiJnQUFBQUFCbnRzV251SUk4T0ozVEk3dTlQODhjZjJQR2hlX2ZtUWdpNlVuUnVsR0pTMExSbUxDSm40U1lWdnlqQk5lWWhpaU5sSE9wN2ROWmx2ZERTc0g1ZTV1VVdSWnI3TDh4QlQ0QzNUajV2MVJFTlVOMURVbz0iLCJkaXNwbGF5X25hbWUiOiJTQVJUSEFLIFNFTkdBUiIsIm9tcyI6IksxIiwiaHNtX2tleSI6ImUxYjcyZjI4Zjg4MDAxOTMxNGE2YWE4MjdmNDhjMGY0M2ZkY2NkNGFlZjdkZDU4NzRhZTkwMjdkIiwiaXNEZHBpRW5hYmxlZCI6bnVsbCwiaXNNdGZFbmFibGVkIjpudWxsLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsInBvYV9mbGFnIjoiTiJ9.WZRrpjc_QC0rwkQs_XdOLmMO5mAZV04y5q188KE9Y7E", "");
// fyersdata.autoreconnect(6);
// fyersdata.connect();

// let userSessions = {}; // Store user subscriptions
// let subscribedSymbols = new Set(); // Track globally subscribed symbols
// let symbolSubscribers = {}; // Track which users are subscribed to each symbol
// let indicesSubscription = [];

// // Subscribe to symbols (only if not already subscribed)
// function updateSubscription(symbols, userId) {
//     const newSymbols = symbols.filter(symbol => !subscribedSymbols.has(symbol));
//     if (newSymbols.length > 0) {
//         fyersdata.subscribe(newSymbols);
//         newSymbols.forEach(symbol => {
//             subscribedSymbols.add(symbol);
//             if (!symbolSubscribers[symbol]) {
//                 symbolSubscribers[symbol] = new Set();
//             }
//         });
//         console.log(`✅ Subscribed to new symbols: ${newSymbols}`);
//     }
//     symbols.forEach(symbol => {
//         symbolSubscribers[symbol].add(userId);
//     });
//     logSubscriptions();
// }

// // Unsubscribe symbols only if no users are subscribed
// function updateUnsubscription() {
//     for (const symbol of subscribedSymbols) {
//         const stillNeeded = Object.values(userSessions).some(session =>
//             Object.values(session.categories || {}).flat().includes(symbol)
//         );

//         if (!stillNeeded) {
//             fyersdata.unsubscribe([symbol]);
//             subscribedSymbols.delete(symbol);
//             delete symbolSubscribers[symbol];
//             console.log(`❌ Unsubscribed from symbol: ${symbol}`);
//         }
//     }
//     logSubscriptions();
// }

// // Logging function to debug user subscriptions
// function logSubscriptions() {
//     console.log("=== Current Symbol Subscriptions ===");
//     for (const [symbol, users] of Object.entries(symbolSubscribers)) {
//         console.log(`📊 Symbol: ${symbol}, Users: ${Array.from(users).join(", ")}`);
//     }
// }

// // Handle Fyers WebSocket connection
// fyersdata.on("connect", () => {
//     console.log("✅ Connected to Fyers WebSocket");
//     if (indicesSubscription.length > 0) {
//         fyersdata.subscribe(indicesSubscription);
//     }
// });

// // Handle incoming Fyers data
// fyersdata.on("message", (message) => {
//     try {
//         if (!message?.symbol || message.ltp === undefined) return;

//         const filteredData = {
//             symbol: message.symbol,
//             ltp: message.ltp,
//             ch: message.ch,
//             chp: message.chp,
//         };

//         console.log(`🔔 Received data for ${message.symbol}:`, filteredData);

//         // Broadcast to all users subscribed to this symbol
//         for (const [userId, session] of Object.entries(userSessions)) {
//             for (const [category, symbols] of Object.entries(session.categories || {})) {
//                 if (symbols.includes(message.symbol)) {
//                     session.clients.forEach(client => {
//                         client.res.write(`data: ${JSON.stringify({ category, ...filteredData })}\n\n`);
//                     });
//                     console.log(`📤 Sent ${message.symbol} data to User ${userId} (Category: ${category})`);
//                 }
//             }
//         }
//     } catch (error) {
//         console.error("❌ Error processing message:", error);
//     }
// });

// // API for subscribing to a category
// function createCategoryAPI(category) {
//     app.post(`/data/${category}`, (req, res) => {
//         const { userId, symbols } = req.body;
//         if (!userId || !Array.isArray(symbols)) {
//             return res.status(400).json({ error: "Invalid request" });
//         }

//         if (!userSessions[userId]) {
//             userSessions[userId] = { clients: [], categories: {} };
//         }
//         userSessions[userId].categories[category] = symbols;

//         if (category === "indices") {
//             indicesSubscription = [...new Set([...indicesSubscription, ...symbols])];
//             fyersdata.subscribe(indicesSubscription);
//         } else {
//             updateSubscription(symbols, userId);
//         }

//         console.log(`👤 User ${userId} subscribed to ${category}:`, symbols);
//         res.json({ message: `${category} data updated successfully` });
//     });
// }

// // Create APIs for all categories
// ["indices", "watchlist", "positions", "investments", "buy-sell"].forEach(createCategoryAPI);

// // Real-time data subscription
// app.get("/subscribe", (req, res) => {
//     const { userId } = req.query;
//     if (!userId || !userSessions[userId]) {
//         return res.status(400).json({ error: "Invalid userId" });
//     }

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

// // Unsubscribe from a category
// app.post("/unsubscribe-category", (req, res) => {
//     const { userId, category } = req.body;
//     if (!userId || !category || !userSessions[userId]) {
//         return res.status(400).json({ error: "Invalid request" });
//     }

//     // Remove category from user session
//     delete userSessions[userId].categories[category];

//     // Remove user from the symbolSubscribers list
//     for (const symbol of Object.keys(symbolSubscribers)) {
//         symbolSubscribers[symbol].delete(userId);
//         if (symbolSubscribers[symbol].size === 0) {
//             delete symbolSubscribers[symbol];
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
const fyersdata = new FyersSocket("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuZnllcnMuaW4iLCJpYXQiOjE3NDAxOTkyODksImV4cCI6MTc0MDI3MDYyOSwibmJmIjoxNzQwMTk5Mjg5LCJhdWQiOlsieDowIiwiZDoxIiwiZDoyIl0sInN1YiI6ImFjY2Vzc190b2tlbiIsImF0X2hhc2giOiJnQUFBQUFCbnVWVjV6aW5rM212VzFVcm12eXI0cEl6dFZtTXZPU2hBZDVlV05fWFZUMDFGU3lpS0lTYkFFQ1I3SjNVWGYzS2FZM0NvMF9xRjJwUGxYU2JnWDQxbDBUTTN4RkJveDFrOGU1R09xd3RSbnBld1hDTT0iLCJkaXNwbGF5X25hbWUiOiJTQVJUSEFLIFNFTkdBUiIsIm9tcyI6IksxIiwiaHNtX2tleSI6ImUxYjcyZjI4Zjg4MDAxOTMxNGE2YWE4MjdmNDhjMGY0M2ZkY2NkNGFlZjdkZDU4NzRhZTkwMjdkIiwiaXNEZHBpRW5hYmxlZCI6bnVsbCwiaXNNdGZFbmFibGVkIjpudWxsLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsInBvYV9mbGFnIjoiTiJ9.gH9NBF8_Qw6pgDJWOw0B0_QGIGemYd_LYZ08OYlJy_g", "");
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
["indices", "watchlist", "positions", "investments", "buy-sell"].forEach(category => {
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