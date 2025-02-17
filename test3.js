// const express = require("express");
// const http = require("http");
// const FyersSocket = require("fyers-api-v3").fyersDataSocket;
// const app = express();

// const cors = require("cors");

// app.use(express.json()); 

// const server = http.createServer(app);
// app.use(cors({ origin: '*' }));



// // Initialize Fyers WebSocket
// const fyersdata = new FyersSocket("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuZnllcnMuaW4iLCJpYXQiOjE3Mzk1OTg2ODQsImV4cCI6MTczOTY2NTgyNCwibmJmIjoxNzM5NTk4Njg0LCJhdWQiOlsieDowIiwiZDoxIiwiZDoyIl0sInN1YiI6ImFjY2Vzc190b2tlbiIsImF0X2hhc2giOiJnQUFBQUFCbnNDdGNSTi1UcERpdHZYaVFDWkhHVENLb3dQS2I0c0FjUVA5dzZOQ05Ga3N3enY3WFlseGNkMDZyRTVLQlRXN2xlakladmR1ZFYyMWZOQ1FmRkFfcXU4dUZsdE80VlZ5cThfbmsyYzFKV0FOOC0xYz0iLCJkaXNwbGF5X25hbWUiOiJTQVJUSEFLIFNFTkdBUiIsIm9tcyI6IksxIiwiaHNtX2tleSI6ImUxYjcyZjI4Zjg4MDAxOTMxNGE2YWE4MjdmNDhjMGY0M2ZkY2NkNGFlZjdkZDU4NzRhZTkwMjdkIiwiaXNEZHBpRW5hYmxlZCI6bnVsbCwiaXNNdGZFbmFibGVkIjpudWxsLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsInBvYV9mbGFnIjoiTiJ9.6BIG4sEDDx7TNZ78xUbquB9Qsk5Ua7lAzRyydWmhx2Y", "");
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
app.use(cors({ origin: '*' }));

const server = http.createServer(app);

// Initialize Fyers WebSocket
const fyersdata = new FyersSocket("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuZnllcnMuaW4iLCJpYXQiOjE3Mzk3NjU4NzIsImV4cCI6MTczOTgzODY1MiwibmJmIjoxNzM5NzY1ODcyLCJhdWQiOlsieDowIiwiZDoxIiwiZDoyIl0sInN1YiI6ImFjY2Vzc190b2tlbiIsImF0X2hhc2giOiJnQUFBQUFCbnNyaHdkUGNXVXFCR0VoMzRiOV9welBmMThQMXlIQWw1SlRxeXBfTnZkNGtIekl5OVB0SkN0THFTbFJiaVplbUV1WTFoSlJSQmFQVENLaFZhZHFRZHk3S2tOYVZ4UVZjY3ctLWFONXJxVmVJVm5WQT0iLCJkaXNwbGF5X25hbWUiOiJTQVJUSEFLIFNFTkdBUiIsIm9tcyI6IksxIiwiaHNtX2tleSI6ImUxYjcyZjI4Zjg4MDAxOTMxNGE2YWE4MjdmNDhjMGY0M2ZkY2NkNGFlZjdkZDU4NzRhZTkwMjdkIiwiaXNEZHBpRW5hYmxlZCI6bnVsbCwiaXNNdGZFbmFibGVkIjpudWxsLCJmeV9pZCI6IlhTMDc4MDMiLCJhcHBUeXBlIjoxMDAsInBvYV9mbGFnIjoiTiJ9.mrdwzuJxIii8XtpgHoXd4iBxwITv-xO8ttWI9Kalyqo", "");
fyersdata.autoreconnect(6);
fyersdata.connect();

let userSessions = {}; // Stores users and their subscriptions
let subscribedSymbols = new Set(); // Tracks globally subscribed symbols
let symbolLTP = {}; // Stores the last traded price (LTP) for each symbol
let indicesSubscription = []; // Stores indices subscriptions

function updateSubscription(symbols) {
  const newSymbols = symbols.filter((symbol) => !subscribedSymbols.has(symbol));
  if (newSymbols.length) {
    console.log(`Subscribing to symbols: ${newSymbols}`);
    fyersdata.subscribe(newSymbols);
    newSymbols.forEach((symbol) => subscribedSymbols.add(symbol));
  }
}

function updateUnsubscription() {
  const allSubscribed = new Set(Object.values(userSessions).flatMap((session) => Object.values(session.categories || {}).flat()));
  subscribedSymbols.forEach((symbol) => {
    if (!allSubscribed.has(symbol)) {
      console.log(`Unsubscribing from symbol: ${symbol}`);
      fyersdata.unsubscribe([symbol]);
      subscribedSymbols.delete(symbol);
    }
  });
}

fyersdata.on("connect", () => {
  console.log("Connected to Fyers WebSocket");
  if (indicesSubscription.length) fyersdata.subscribe(indicesSubscription);
});

fyersdata.on("message", (message) => {
  try {
    if (!message?.symbol || message.ltp === undefined) return;
    symbolLTP[message.symbol] = message.ltp; // Store LTP for offline access

    Object.entries(userSessions).forEach(([userId, session]) => {
      Object.entries(session.categories || {}).forEach(([category, symbols]) => {
        if (symbols.includes(message.symbol)) {
          const filteredData = { category, symbol: message.symbol, ltp: message.ltp, ch: message.ch, chp: message.chp };
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

function createCategoryAPI(category) {
  app.post(`/data/${category}`, (req, res) => {
    const { userId, symbols } = req.body;
    if (!userId || !Array.isArray(symbols)) return res.status(400).json({ error: "Invalid request" });

    console.log(`User ${userId} subscribed to category ${category} with symbols: ${symbols}`);

    if (!userSessions[userId]) userSessions[userId] = { clients: [], categories: {} };
    userSessions[userId].categories[category] = symbols;

    if (category === "indices") {
      indicesSubscription = [...new Set([...indicesSubscription, ...symbols])];
      fyersdata.subscribe(indicesSubscription);
    } else {
      updateSubscription(symbols);
    }

    res.json({ message: `${category} data updated successfully` });
  });
}

["indices", "watchlist", "positions", "investments", "buy-sell"].forEach(createCategoryAPI);

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
    symbols.forEach((symbol) => {
      if (symbolLTP[symbol]) {
        res.write(`data: ${JSON.stringify({ category, symbol, ltp: symbolLTP[symbol] })}\n\n`);
      }
    });
  });

  req.on("close", () => {
    userSessions[userId].clients = userSessions[userId].clients.filter((client) => client.res !== res);
    updateUnsubscription();
  });
});

app.post("/unsubscribe-category", (req, res) => {
  const { userId, category } = req.body;
  if (!userId || !category || !userSessions[userId]) return res.status(400).json({ error: "Invalid request" });

  console.log(`User ${userId} unsubscribed from category ${category}`);
  delete userSessions[userId].categories[category];
  updateUnsubscription();
  res.json({ message: `User unsubscribed from ${category}` });
});

const PORT = process.env.PORT || 7000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

