// const express = require("express");
// const http = require("http");
// const FyersSocket = require("fyers-api-v3").fyersDataSocket;
// const app = express();

// const cors = require("cors");

// app.use(express.json()); 

// const server = http.createServer(app);
// app.use(cors({ origin: '*' }));



// // Initialize Fyers WebSocket
// const fyersdata = new FyersSocket("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuZnllcnMuaW4iLCJpYXQiOjE3MzkyNTM2NzEsImV4cCI6MTczOTMyMDIxMSwibmJmIjoxNzM5MjUzNjcxLCJhdWQiOlsieDowIiwiZDoxIiwiZDoyIl0sInN1YiI6ImFjY2Vzc190b2tlbiIsImF0X2hhc2giOiJnQUFBQUFCbnF1ZW5GekdGWUhmZkxrQWJOUENWeUVWeC14OUgwNTNEQmNnSHBQLUtwOXlhMzBsNTRXa1kwbW5VdEp5WHlBYWxOVXVNNTdRMVh2ZENFWHgtV0MxWklnb1ZUR2dGeGo3ajNfWTVuTmw4UVVhdmlzND0iLCJkaXNwbGF5X25hbWUiOiJTQVJUSEFLIFNFTkdBUiIsIm9tcyI6IksxIiwiaHNtX2tleSI6ImUxYjcyZjI4Zjg4MDAxOTMxNGE2YWE4MjdmNDhjMGY0M2ZkY2NkNGFlZjdkZDU4NzRhZTkwMjdkIiwiaXNEZHBpRW5hYmxlZCI6bnVsbCwiaXNNdGZFbmFibGVkIjpudWxsLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsInBvYV9mbGFnIjoiTiJ9.PstZ2xdsC9t7Q6ttayUq9ouVig3d-ZAtlHnjc7K2dsE", "");
// fyersdata.autoreconnect(6);
// fyersdata.connect();

// // User session store
// let userSessions = {};
// let subscribedSymbols = new Set();
// let indicesSubscription = [];

// // Subscribe to a symbol if not already subscribed
// function updateSubscription(symbols) {
//   const newSymbols = symbols.filter((symbol) => !subscribedSymbols.has(symbol));
//   if (newSymbols.length) {
//     fyersdata.subscribe(newSymbols);
//     newSymbols.forEach((symbol) => subscribedSymbols.add(symbol));
//   }
// }

// // Unsubscribe from symbols no longer needed
// function updateUnsubscription() {
//   const allSubscribed = new Set(Object.values(userSessions).flatMap((session) => Object.values(session.categories || {}).flat()));
//   subscribedSymbols.forEach((symbol) => {
//     if (!allSubscribed.has(symbol)) {
//       fyersdata.unsubscribe([symbol]);
//       subscribedSymbols.delete(symbol);
//     }
//   });
// }

// // Handle Fyers WebSocket connection
// fyersdata.on("connect", () => {
//   console.log("Connected to Fyers WebSocket");
//   if (indicesSubscription.length) fyersdata.subscribe(indicesSubscription);
// });

// // WebSocket message handling
// fyersdata.on("message", (message) => {
//   try {
//     if (!message?.symbol || message.ltp === undefined) return;
//     // console.log(message);
    
//     if (indicesSubscription.includes(message.symbol)) {
//       Object.values(userSessions).forEach((session) => {
//         session.clients.forEach((client) => {
//           client.res.write(`data: ${JSON.stringify({ category: "indices", ...message })}\n\n`);
//         });
//       });
//       return;
//     }

//     Object.entries(userSessions).forEach(([userId, session]) => {
//       Object.entries(session.categories || {}).forEach(([category, symbols]) => {
//         if (symbols.includes(message.symbol)) {
//           const filteredData = { category, symbol: message.symbol, ltp: message.ltp,ch:message.ch,chp:message.chp };
//           session.clients.forEach((client) => {
//             client.res.write(`data: ${JSON.stringify(filteredData)}\n\n`);
//           });
//         }
//       });
//     });
//   } catch (error) {
//     console.error("Error processing message:", error);
//   }
// });

// // Generic category API handler
// function createCategoryAPI(category) {
//   app.post(`/data/${category}`, (req, res) => {

//     console.log("first api called");
    
//     const { userId, symbols } = req.body;
//     if (!userId || !Array.isArray(symbols)) return res.status(400).json({ error: "Invalid request" });

//     if (!userSessions[userId]) userSessions[userId] = { clients: [], categories: {} };
//     userSessions[userId].categories[category] = symbols;

//     if (category === "indices") {
//       console.log("first inner api called");
//       indicesSubscription = [...new Set([...indicesSubscription, ...symbols])];
//       fyersdata.subscribe(indicesSubscription);
//       console.log("first innerinner api called");
//     } else {
//       updateSubscription(symbols);
//     }

//     res.json({ message: `${category} data updated successfully` });
//   });
// }

// // Create APIs for all categories
// ["indices", "watchlist", "positions", "investments","buy-sell"].forEach(createCategoryAPI);

// // Real-time data subscription
// app.get("/subscribe", (req, res) => {
   
//   console.log("second api called");
//   const { userId } = req.query;
//   if (!userId || !userSessions[userId]) return res.status(400).json({ error: "Invalid userId" });

//   res.setHeader("Content-Type", "text/event-stream");
//   res.setHeader("Cache-Control", "no-cache");
//   res.setHeader("Connection", "keep-alive");
//   res.flushHeaders();

//   res.write(`data: ${JSON.stringify({ message: "Subscribed to live updates" })}\n\n`);
//   userSessions[userId].clients.push({ res });

//   req.on("close", () => {
//     userSessions[userId].clients = userSessions[userId].clients.filter((client) => client.res !== res);
//     updateUnsubscription();
//   });
//   console.log(`User ${userId} subscribed for real-time updates.`);
// });

// // Unsubscribe from category
// app.post("/unsubscribe-category", (req, res) => {
//   const { userId, category } = req.body;
//   if (!userId || !category || !userSessions[userId]) return res.status(400).json({ error: "Invalid request" });

//   delete userSessions[userId].categories[category];
//   updateUnsubscription();

//   res.json({ message: `User unsubscribed from ${category}` });
// });

// // Start server
// const PORT = process.env.PORT || 7000;
// server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));


const express = require("express");
const http = require("http");
const FyersSocket = require("fyers-api-v3").fyersDataSocket;
const app = express();
const cors = require("cors");

app.use(express.json());
const server = http.createServer(app);
app.use(cors({ origin: '*' }));

const fyersdata = new FyersSocket("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuZnllcnMuaW4iLCJpYXQiOjE3MzkyNTM2NzEsImV4cCI6MTczOTMyMDIxMSwibmJmIjoxNzM5MjUzNjcxLCJhdWQiOlsieDowIiwiZDoxIiwiZDoyIl0sInN1YiI6ImFjY2Vzc190b2tlbiIsImF0X2hhc2giOiJnQUFBQUFCbnF1ZW5GekdGWUhmZkxrQWJOUENWeUVWeC14OUgwNTNEQmNnSHBQLUtwOXlhMzBsNTRXa1kwbW5VdEp5WHlBYWxOVXVNNTdRMVh2ZENFWHgtV0MxWklnb1ZUR2dGeGo3ajNfWTVuTmw4UVVhdmlzND0iLCJkaXNwbGF5X25hbWUiOiJTQVJUSEFLIFNFTkdBUiIsIm9tcyI6IksxIiwiaHNtX2tleSI6ImUxYjcyZjI4Zjg4MDAxOTMxNGE2YWE4MjdmNDhjMGY0M2ZkY2NkNGFlZjdkZDU4NzRhZTkwMjdkIiwiaXNEZHBpRW5hYmxlZCI6bnVsbCwiaXNNdGZFbmFibGVkIjpudWxsLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsInBvYV9mbGFnIjoiTiJ9.PstZ2xdsC9t7Q6ttayUq9ouVig3d-ZAtlHnjc7K2dsE", "");
fyersdata.autoreconnect(6);
fyersdata.connect();

let userSessions = {}; // Store user subscriptions
let subscribedSymbols = new Set(); // Track globally subscribed symbols
let symbolSubscribers = {}; // Track which users are subscribed to each symbol
let indicesSubscription = [];

function updateSubscription(symbols, userId) {
    const newSymbols = symbols.filter(symbol => !subscribedSymbols.has(symbol));
    if (newSymbols.length > 0) {
        fyersdata.subscribe(newSymbols);
        newSymbols.forEach(symbol => {
            subscribedSymbols.add(symbol);
            if (!symbolSubscribers[symbol]) {
                symbolSubscribers[symbol] = new Set();
            }
        });
        console.log(`✅ Subscribed to new symbols: ${newSymbols}`);
    }
    symbols.forEach(symbol => {
        symbolSubscribers[symbol].add(userId);
    });
    logSubscriptions();
}

function updateUnsubscription() {
    for (const symbol of subscribedSymbols) {
        const stillNeeded = Object.values(userSessions).some(session =>
            Object.values(session.categories || {}).flat().includes(symbol)
        );

        if (!stillNeeded) {
            fyersdata.unsubscribe([symbol]);
            subscribedSymbols.delete(symbol);
            delete symbolSubscribers[symbol];
            console.log(`❌ Unsubscribed from symbol: ${symbol}`);
        }
    }
    logSubscriptions();
}

function logSubscriptions() {
    console.log("\n=== Current Symbol Subscriptions ===");
    for (const [symbol, users] of Object.entries(symbolSubscribers)) {
        console.log(`📊 Symbol: ${symbol}, Users: ${Array.from(users).join(", ")}`);
    }
}

fyersdata.on("connect", () => {
    console.log("✅ Connected to Fyers WebSocket");
    if (indicesSubscription.length > 0) {
        fyersdata.subscribe(indicesSubscription);
    }
});

fyersdata.on("message", (message) => {
    try {
        if (!message?.symbol) return;

        console.log(`🔔 Data received for symbol: ${message.symbol}`);

        for (const [userId, session] of Object.entries(userSessions)) {
            for (const [category, symbols] of Object.entries(session.categories || {})) {
                if (symbols.includes(message.symbol)) {
                    session.clients.forEach(client => {
                        client.res.write(`data: ${JSON.stringify({ category, symbol: message.symbol })}\n\n`);
                    });
                    console.log(`📤 User ${userId} received ${message.symbol} (Category: ${category})`);
                }
            }
        }
    } catch (error) {
        console.error("❌ Error processing message:", error);
    }
});

function createCategoryAPI(category) {
    app.post(`/data/${category}`, (req, res) => {
        const { userId, symbols } = req.body;
        if (!userId || !Array.isArray(symbols)) {
            return res.status(400).json({ error: "Invalid request" });
        }

        if (!userSessions[userId]) {
            userSessions[userId] = { clients: [], categories: {} };
        }
        userSessions[userId].categories[category] = symbols;

        if (category === "indices") {
            indicesSubscription = [...new Set([...indicesSubscription, ...symbols])];
            fyersdata.subscribe(indicesSubscription);
        } else {
            updateSubscription(symbols, userId);
        }

        console.log(`👤 User ${userId} subscribed to ${category}:`, symbols);
        res.json({ message: `${category} data updated successfully` });
    });
}

["indices", "watchlist", "positions", "investments", "buy-sell"].forEach(createCategoryAPI);

app.get("/subscribe", (req, res) => {
    const { userId } = req.query;
    if (!userId || !userSessions[userId]) {
        return res.status(400).json({ error: "Invalid userId" });
    }

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

app.post("/unsubscribe-category", (req, res) => {
    const { userId, category } = req.body;
    if (!userId || !category || !userSessions[userId]) {
        return res.status(400).json({ error: "Invalid request" });
    }

    delete userSessions[userId].categories[category];

    for (const symbol of Object.keys(symbolSubscribers)) {
        symbolSubscribers[symbol].delete(userId);
        if (symbolSubscribers[symbol].size === 0) {
            delete symbolSubscribers[symbol];
        }
    }

    updateUnsubscription();
    console.log(`🚫 User ${userId} unsubscribed from ${category}`);
    res.json({ message: `User unsubscribed from ${category}` });
});

const PORT = process.env.PORT || 7000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

