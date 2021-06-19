require("source-map-support").install();
const { getImageResults } = require("./utils/imageUtils");
const express = require("express");
const { ExpressPeerServer } = require("peer");
const axios = require("axios");

const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const app = express();

const httpProxy = require("http-proxy");
var proxy = httpProxy.createProxyServer();
const { userJoin, getRoomUsers, userLeave } = require("./utils/users");
const { join } = require("path");

app.use(cors());

const server = http.createServer(app);
const io = socketIo(server);

const peerServer = ExpressPeerServer(server, {
  debug: true,
});

app.use("/signaling", peerServer);
app.use("/api", (req, res, next) => {
  console.log("proxied request", req.url, req.method);
  proxy.web(
    req,
    res,
    {
      target: "http://localhost:8080",
    },
    next
  );
});

io.on("connection", (socket) => {
  console.log("got connection");
  let joinedUser = null;
  let dataCollectionInterval = null;

  socket.on("join-room", ({ id, username, room }) => {
    console.log("user joined ", { id, username, room });
    if (id === null) {
      console.log("invalid user id", { id, username, room });
      return;
    }
    const user = userJoin(id, username, room);
    joinedUser = user;

    if (user === null) {
      // user is already in room
      console.log("user already in room ", { id, username, room });
      return;
    }
    socket.join(user.room);
    // Broadcast when  a user connects
    socket.broadcast
      .to(user.room)
      .emit("room-users-joined", { userId: user.id, username: username });

    // Send users and Room info
    io.to(user.room).emit("room-users", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
    dataCollectionInterval = setInterval(() => {
      io.to(user.room).emit("get-image");
    }, 3000);
  });

  // Runs when client disconnects
  socket.on("disconnect", () => {
    console.log("user disconected ", { ...joinedUser });

    if (joinedUser) {
      const user = userLeave(joinedUser.id);
      io.to(joinedUser.room).emit("room-users-left", { userId: user.username });

      // Send users and room info
      io.to(joinedUser.room).emit("room-users", {
        room: joinedUser.room,
        users: getRoomUsers(joinedUser.room),
      });
      joinedUser = null;
    }
    if (dataCollectionInterval) {
      clearInterval(dataCollectionInterval);
    }
  });

  // Listen to WebcamOn
  socket.on("webcam-on", () => {
    if (joinedUser) {
      joinedUser.cam = true;
      io.to(joinedUser.room).emit("add-webcam-icon", user.id);
    }
  });

  // Listen to webcamOff
  socket.on("webcam-off", () => {
    if (joinedUser) {
      joinedUser.cam = false;
      io.to(user.room).emit("remove-webcam-icon-stream-called", user.id);
    }
  });

  socket.on("room-chat-message-post", (message) => {
    if (joinedUser) {
      console.log("recived a new message in chat", message);
      io.to(joinedUser.room).emit("room-chat-message-post", message);
    }
  });

  socket.on("room-chat-message-history", () => {
    const user = joinedUser;

    if (user) {
      console.log("sending message history");
      io.to(user.id).emit("room-chat-message-all", { messages: [] });
    }
  });
  socket.on("get-image-response", (data) => {
    try {
      getImageResults(data.img).then((results) => {
        console.log(joinedUser);
        console.log(results, results.absent ? "absent" : "emotions");
        return axios
          .post(
            `http://localhost:8080/conference/${joinedUser.room}/metadata`,
            {
              user: joinedUser,
              metadata: results,
              type: results.absent ? "absent" : "emotions",
            }
          )
          .then(({ data }) => {
            console.log(data);
          });
      });
    } catch (err) {
      console.log(err);
    }
  });
});

server.listen(9000, "0.0.0.0", () =>
  console.log(`Server running on http://127.0.0.1:${9000}`)
);

io.listen(server, "0.0.0.0");
