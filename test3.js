

const express = require("express");
const http = require("http");
const FyersSocket = require("fyers-api-v3").fyersDataSocket;
const app = express();

const cors = require("cors");

app.use(express.json()); 

const server = http.createServer(app);
// Example with CORS configured for ngrok URL
// app.use(cors({
//   origin: ['http://localhost:3000', 'https://b869-2405-201-300b-78b9-3d64-2dff-acd9-b869.ngrok-free.app'],
// }));


app.use(cors({ origin: '*' }));



// Initialize Fyers WebSocket
const fyersdata = new FyersSocket("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuZnllcnMuaW4iLCJpYXQiOjE3Mzg5MDY3MzksImV4cCI6MTczODk3NDY1OSwibmJmIjoxNzM4OTA2NzM5LCJhdWQiOlsieDowIiwiZDoxIiwiZDoyIl0sInN1YiI6ImFjY2Vzc190b2tlbiIsImF0X2hhc2giOiJnQUFBQUFCbnBaeHozam9TT2RPV3BfNnF3X29UWU1pZEQ2ZU9iM050bUpyRjhMZ0daSEFhWUZFRmpXakVUNUtrTHpDYVozS29heDdjNE91M3ZnVzQ4dFpNd2NUM3FuVmVMQ3MwLTZlczJrbzZyLUtWZVd5TmhDVT0iLCJkaXNwbGF5X25hbWUiOiJTQVJUSEFLIFNFTkdBUiIsIm9tcyI6IksxIiwiaHNtX2tleSI6ImUxYjcyZjI4Zjg4MDAxOTMxNGE2YWE4MjdmNDhjMGY0M2ZkY2NkNGFlZjdkZDU4NzRhZTkwMjdkIiwiaXNEZHBpRW5hYmxlZCI6bnVsbCwiaXNNdGZFbmFibGVkIjpudWxsLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsInBvYV9mbGFnIjoiTiJ9.4ETF6pH_k6jtddIdeKz4WKJ7Ekqytqzfu36KwiIdyvE", "");
fyersdata.autoreconnect(6);
fyersdata.connect();

// User session store
let userSessions = {};
let subscribedSymbols = new Set();
let indicesSubscription = [];

// Subscribe to a symbol if not already subscribed
function updateSubscription(symbols) {
  const newSymbols = symbols.filter((symbol) => !subscribedSymbols.has(symbol));
  if (newSymbols.length) {
    fyersdata.subscribe(newSymbols);
    newSymbols.forEach((symbol) => subscribedSymbols.add(symbol));
  }
}

// Unsubscribe from symbols no longer needed
function updateUnsubscription() {
  const allSubscribed = new Set(Object.values(userSessions).flatMap((session) => Object.values(session.categories || {}).flat()));
  subscribedSymbols.forEach((symbol) => {
    if (!allSubscribed.has(symbol)) {
      fyersdata.unsubscribe([symbol]);
      subscribedSymbols.delete(symbol);
    }
  });
}

// Handle Fyers WebSocket connection
fyersdata.on("connect", () => {
  console.log("Connected to Fyers WebSocket");
  if (indicesSubscription.length) fyersdata.subscribe(indicesSubscription);
});

// WebSocket message handling
fyersdata.on("message", (message) => {
  try {
    if (!message?.symbol || message.ltp === undefined) return;

    if (indicesSubscription.includes(message.symbol)) {
      Object.values(userSessions).forEach((session) => {
        session.clients.forEach((client) => {
          client.res.write(`data: ${JSON.stringify({ category: "indices", ...message })}\n\n`);
        });
      });
      return;
    }

    Object.entries(userSessions).forEach(([userId, session]) => {
      Object.entries(session.categories || {}).forEach(([category, symbols]) => {
        if (symbols.includes(message.symbol)) {
          const filteredData = { category, symbol: message.symbol, ltp: message.ltp };
          session.clients.forEach((client) => {
            client.res.write(`data: ${JSON.stringify(filteredData)}\n\n`);
          });
        }
      });
    });
  } catch (error) {
    console.error("Error processing message:", error);
  }
});

// Generic category API handler
function createCategoryAPI(category) {
  app.post(`/data/${category}`, (req, res) => {

    console.log("first api called");
    
    const { userId, symbols } = req.body;
    if (!userId || !Array.isArray(symbols)) return res.status(400).json({ error: "Invalid request" });

    if (!userSessions[userId]) userSessions[userId] = { clients: [], categories: {} };
    userSessions[userId].categories[category] = symbols;

    if (category === "indices") {
      console.log("fiest inner api called");
      indicesSubscription = [...new Set([...indicesSubscription, ...symbols])];
      fyersdata.subscribe(indicesSubscription);
      console.log("fiest innerinner api called");
    } else {
      updateSubscription(symbols);
    }

    res.json({ message: `${category} data updated successfully` });
  });
}

// Create APIs for all categories
["indices", "watchlist", "positions", "investment"].forEach(createCategoryAPI);

// Real-time data subscription
app.get("/subscribe", (req, res) => {
   
  console.log("second api called");
  const { userId } = req.query;
  if (!userId || !userSessions[userId]) return res.status(400).json({ error: "Invalid userId" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ message: "Subscribed to live updates" })}\n\n`);
  userSessions[userId].clients.push({ res });

  req.on("close", () => {
    userSessions[userId].clients = userSessions[userId].clients.filter((client) => client.res !== res);
    updateUnsubscription();
  });
  console.log(`User ${userId} subscribed for real-time updates.`);
});

// Unsubscribe from category
app.post("/unsubscribe-category", (req, res) => {
  const { userId, category } = req.body;
  if (!userId || !category || !userSessions[userId]) return res.status(400).json({ error: "Invalid request" });

  delete userSessions[userId].categories[category];
  updateUnsubscription();

  res.json({ message: `User unsubscribed from ${category}` });
});

// Start server
const PORT = process.env.PORT || 7000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
