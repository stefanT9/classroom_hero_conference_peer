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
  let dataCollectionInterval = null;

  socket.on("join-room", ({ id, username, room }) => {
    console.log("user joined ", { id, username, room });
    if (id === null) {
      console.log("invalid user id", { id, username, room });
      return;
    }
    const user = { id, username, room, cam: false };

    if (user === null) {
      // user is already in room
      console.log("user already in room ", { id, username, room });
      return;
    }

    // Broadcast when  a user connects
    socket.broadcast
      .to(user.room)
      .emit("room-users-joined", { userId: user.id, username });
    io.to(user.room).emit("user-joined", {
      user,
    });

    socket.join(user.room);

    // Image analysis interval
    dataCollectionInterval = setInterval(() => {
      try {
        io.to(user.room).emit("get-image");
      } catch (err) {
        console.log(err);
      }
    }, 5000);

    // Runs when client disconnects
    socket.on("disconnect", () => {
      console.log("user disconected ", { ...user });

      // const user = userLeave(joinedUser.id);
      io.to(user.room).emit("room-users-left", {
        userId: user.id,
      });

      if (dataCollectionInterval) {
        clearInterval(dataCollectionInterval);
      }
    });
    // Listen to WebcamOn
    socket.on("webcam-on", () => {
      user.cam = true;
      io.to(user.room).emit("add-webcam-icon", user.id);
    });

    // Listen to webcamOff
    socket.on("webcam-off", () => {
      user.cam = false;
      io.to(user.room).emit("remove-webcam-icon-stream-called", user.id);
    });

    socket.on("room-chat-message-post", (message) => {
      console.log("meesage ");
      console.log("recived a new message in chat", message);
      io.to(user.room).emit("room-chat-message-post", message);
    });

    socket.on("room-chat-message-history", () => {
      console.log("sending message history");
      io.to(user.id).emit("room-chat-message-all", { messages: [] });
    });
    socket.on("get-image-response", (data) => {
      try {
        getImageResults(data.img)
          .then((results) => {
            console.log(user);
            console.log(results, results.absent ? "absent" : "emotions");
            return axios
              .post(`http://localhost:8080/conference/${room}/metadata`, {
                user,
                metadata: results,
                type: results.absent ? "absent" : "emotions",
              })
              .then(({ data }) => {
                console.log(data);
              })
              .catch((err) => {
                console.log(err);
              });
          })
          .catch((err) => {
            console.log("error on get-image-response", err.message);
          });
      } catch (err) {
        console.log(err);
      }
    });
  });
});

server.listen(9001, () =>
  console.log(`Server running on http://127.0.0.1:${90001}`)
);

io.listen(server);
