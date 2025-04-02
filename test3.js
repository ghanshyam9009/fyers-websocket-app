

const express = require("express");
const http = require("http");
const FyersSocket = require("fyers-api-v3").fyersDataSocket;
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors({ origin: '*' }));

const fyersdata = new FyersSocket("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiZDoxIiwiZDoyIiwieDowIl0sImF0X2hhc2giOiJnQUFBQUFCbjdNOTlETDc0UlBNMUlHREVYQXgtOHhRZkJxTUk4MDVOVUhFNnhOMzIza01mckQzcnRqRFhLZXFybkRwQXlJZm5aUjg5RlQ1SmVrQVR1ZkF0MVB5RlBIZXA2VUNaclcwYkd3TFdMRHJrWkFTUjcxZz0iLCJkaXNwbGF5X25hbWUiOiIiLCJvbXMiOiJLMSIsImhzbV9rZXkiOiJlMWI3MmYyOGY4ODAwMTkzMTRhNmFhODI3ZjQ4YzBmNDNmZGNjZDRhZWY3ZGQ1ODc0YWU5MDI3ZCIsImlzRGRwaUVuYWJsZWQiOiIiLCJpc010ZkVuYWJsZWQiOiIiLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsImV4cCI6MTc0MzY0MDIwMCwiaWF0IjoxNzQzNTcyODYxLCJpc3MiOiJhcGkuZnllcnMuaW4iLCJuYmYiOjE3NDM1NzI4NjEsInN1YiI6ImFjY2Vzc190b2tlbiJ9.BIIg1HofAk4yRlMV3QkMbu9iiU78G-K5-CEkVmi_53A", "");
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
        const userDetails = Array.from(users).map(userId => {
            const userCategories = userSessions[userId]?.categories || {};
            return `${userId} (${Object.keys(userCategories).join(", ")})`;
        }).join(", ");
        console.log(`📊 Symbol: ${symbol}, Users: ${userDetails}`);
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
    // if (!userId || !userSessions[userId]) return res.status(400).json({ error: "Invalid userId" });
     if (!userId) return res.status(400).json({ error: "Invalid userId" });
    
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
    // if (!userId || !category || !userSessions[userId]) return res.status(400).json({ error: "Invalid request" });
    if (!userId || !category) return res.status(400).json({ error: "Invalid request" });
   
    if (!userSessions[userId].categories[category]) {
        return res.json({ message: `User is not subscribed to ${category}` });
    }
    
    delete userSessions[userId].categories[category];
    console.log(`❌ User ${userId} unsubscribed from category ${category}`);
    
    updateUnsubscription();
    res.json({ message: `User unsubscribed from ${category}` });
});

app.post("/add", (req, res) => {
    const { userId, symbol } = req.body;
    if (!userId || !symbol) return res.status(400).json({ error: "Invalid request" });
    
    console.log(`🔹 Add API called for user: ${userId}, symbol: ${symbol}`);
    
    userSessions[userId] = userSessions[userId] || { clients: [], categories: {} };
    userSessions[userId].categories["watchlist"] = userSessions[userId].categories["custom"] || [];
    
    if (!userSessions[userId].categories["watchlist"].includes(symbol)) {
        userSessions[userId].categories["watchlist"].push(symbol);
        updateSubscription([symbol], userId, "custom");
    }
    
    console.log(`✅ User ${userId} successfully added symbol ${symbol}`);
    res.json({ message: `Symbol ${symbol} added for user ${userId}` });
});

app.post("/remove", (req, res) => {
    const { userId, symbol } = req.body;
    if (!userId || !symbol) return res.status(400).json({ error: "Invalid request" });

    console.log(`🔸 Remove API called for user: ${userId}, symbol: ${symbol}`);

    if (!userSessions[userId] || !userSessions[userId].categories["custom"]) {
        return res.status(400).json({ error: "User or category not found" });
    }

    userSessions[userId].categories["watchlist"] = userSessions[userId].categories["custom"].filter(sym => sym !== symbol);

    if (userSessions[userId].categories["watchlist"].length === 0) {
        delete userSessions[userId].categories["watchlist"];
    }

    updateUnsubscription();
    console.log(`✅ User ${userId} successfully removed symbol ${symbol}`);
    res.json({ message: `Symbol ${symbol} removed for user ${userId}` });
});


const PORT = process.env.PORT || 7000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
