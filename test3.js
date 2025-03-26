

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

let userSessions = {};
let subscribedSymbols = new Set();
let symbolSubscribers = {};
let indicesSubscription = new Set();
let lastKnownData = {}; // Store last known data
// let pendingSubscriptions = new Map(); // Track pending re-subscriptions

function updateSubscription(symbols, userId) {
    symbols.forEach(symbol => {
        if (!symbolSubscribers[symbol]) {
            symbolSubscribers[symbol] = new Set();
        }
        symbolSubscribers[symbol].add(userId);
        
        if (!subscribedSymbols.has(symbol)) {
            fyersdata.subscribe([symbol]);
            subscribedSymbols.add(symbol);
        }
        // else if (pendingSubscriptions.has(symbol)) {
        //     // If symbol was previously unsubscribed but still needed, re-subscribe it
        //     fyersdata.subscribe([symbol]);
        //     pendingSubscriptions.delete(symbol);
        // }
    });
    logSubscriptions();
}

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


async function updateUnsubscription() {
    console.log("\n🔍 Checking for unused symbols to unsubscribe...");
    
    for (const symbol of [...subscribedSymbols]) {
        const stillNeeded = Object.values(userSessions).some(session =>
            Object.values(session.categories || {}).some(symbols => symbols.includes(symbol))
        );

        if (!stillNeeded) {
            // console.log(`❌ Unsubscribing from: ${symbol}`);
            // await fyersdata.unsubscribe([symbol]); // Ensure unsubscription completes
            // subscribedSymbols.delete(symbol);
            // // pendingSubscriptions.set(symbol, true); // Mark for re-subscription if needed
            // delete symbolSubscribers[symbol];

            console.log(`❌ Unsubscribing from: ${symbol}`);
            await fyersdata.unsubscribe([symbol]); 
            subscribedSymbols.delete(symbol);
            delete symbolSubscribers[symbol];
            delete lastKnownData[symbol];  // Clear stored data
        } else {
            console.log(`✅ Keeping subscription for: ${symbol}`);
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

        console.log(`📊 Received Data:`, { ...filteredData, ltp: message.ltp });

    
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
        updateSubscription(symbols, userId);
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
    if (!userSessions[userId]) return; // Prevents undefined access

    // Remove the client from the list
    userSessions[userId].clients = userSessions[userId].clients.filter(client => client.res !== res);

    // If the user has no active subscriptions, clean up the session
    if (userSessions[userId].clients.length === 0 && Object.keys(userSessions[userId].categories).length === 0) {
        delete userSessions[userId];
    }

    updateUnsubscription();
});
    console.log(`✅ User ${userId} subscribed for real-time updates.`);
});

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
//     res.json({ message: `User unsubscribed  hjhjhjh from ${category}` });
// });


app.post("/unsubscribe-category", async (req, res) => {
    try {
        const { userId, category } = req.body;
        
        console.log(`\n🔴 Unsubscribing User ${userId} from ${category}`);

        if (!userId || !category || !userSessions[userId]) {
            console.log("❌ Invalid request data.");
            return res.status(400).json({ error: "Invalid request" });
        }

        if (!userSessions[userId].categories[category]) {
            console.log(`⚠️ User ${userId} is not subscribed to ${category}`);
            return res.json({ message: `User is not subscribed to ${category}` });
        }

        const removedSymbols = userSessions[userId].categories[category] || [];
        console.log(`📉 Removing symbols from user session: ${removedSymbols}`);

        delete userSessions[userId].categories[category];

        // Update global tracking for symbols
        for (const symbol of removedSymbols) {
            if (symbolSubscribers[symbol]) {
                symbolSubscribers[symbol].delete(userId);
                console.log(`👤 Removed User ${userId} from symbol ${symbol}`);

                if (symbolSubscribers[symbol].size === 0) {
                    console.log(`🗑 No users left for symbol ${symbol}, marking for unsubscription.`);
                    delete symbolSubscribers[symbol];
                }
            }
        }

        await updateUnsubscription(); // Ensure cleanup completes before responding

        res.json({ message: `User unsubscribed from ${category}` });
    } catch (error) {
        console.error("🚨 Error in /unsubscribe-category:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

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

// function updateSubscription(symbols, userId) {
//     symbols.forEach(symbol => {
//         if (!symbolSubscribers[symbol]) {
//             symbolSubscribers[symbol] = new Set();
//         }
//         symbolSubscribers[symbol].add(userId);
        
//         if (!subscribedSymbols.has(symbol)) {
//             fyersdata.subscribe([symbol]);
//             subscribedSymbols.add(symbol);
//         }
//     });
//     logSubscriptions();
// }

// async function updateUnsubscription() {
//     console.log("\n🔍 Checking for unused symbols to unsubscribe...");
    
//     for (const symbol of [...subscribedSymbols]) {
//         const stillNeeded = Object.values(userSessions).some(session =>
//             Object.values(session.categories || {}).some(symbols => symbols.includes(symbol))
//         );

//         if (!stillNeeded) {
//             console.log(`❌ Unsubscribing from: ${symbol}`);
//             await fyersdata.unsubscribe([symbol]); // Ensure unsubscription completes
//             subscribedSymbols.delete(symbol);
//             delete symbolSubscribers[symbol];
//         } else {
//             console.log(`✅ Keeping subscription for: ${symbol}`);
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

//     console.log(`📊 Received Data:`, { ...filteredData, ltp: message.ltp });

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
//         if (!userSessions[userId]) return; // Prevents undefined access

//         // Remove the client from the list
//         userSessions[userId].clients = userSessions[userId].clients.filter(client => client.res !== res);

//         // If the user has no active subscriptions, clean up the session
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
        
//         console.log(`\n🔴 Unsubscribing User ${userId} from ${category}`);

//         if (!userId || !category || !userSessions[userId]) {
//             console.log("❌ Invalid request data.");
//             return res.status(400).json({ error: "Invalid request" });
//         }

//         if (!userSessions[userId].categories[category]) {
//             console.log(`⚠️ User ${userId} is not subscribed to ${category}`);
//             return res.json({ message: `User is not subscribed to ${category}` });
//         }

//         const removedSymbols = userSessions[userId].categories[category] || [];
//         console.log(`📉 Removing symbols from user session: ${removedSymbols}`);

//         delete userSessions[userId].categories[category];

//         // Update global tracking for symbols
//         for (const symbol of removedSymbols) {
//             if (symbolSubscribers[symbol]) {
//                 symbolSubscribers[symbol].delete(userId);
//                 if (symbolSubscribers[symbol].size === 0) {
//                     delete symbolSubscribers[symbol];
//                 }
//             }
//         }

//         await updateUnsubscription();
//         res.json({ message: `User ${userId} unsubscribed from ${category}` });

//     } catch (error) {
//         console.error("❌ Error in unsubscribe-category:", error);
//         res.status(500).json({ error: "Internal Server Error" });
//     }
// });

// server.listen(3000, () => {
//     console.log("🚀 Server running on port 3000");
// });


