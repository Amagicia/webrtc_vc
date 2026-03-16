/***************************************************
 SIMPLE WEBRTC SIGNALING SERVER
 Handles:
 - room joining
 - forwarding offer / answer / ICE
***************************************************/

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/***************************************************
 SOCKET CONNECTION
***************************************************/
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    /******** USER JOINS ROOM ********/
    socket.on("join-room", (roomId) => {
        socket.join(roomId);

        console.log(socket.id, "joined", roomId);

        // notify existing users
        socket.to(roomId).emit("user-joined", socket.id);
    });

    /******** OFFER ********/
    socket.on("offer", (data) => {
        io.to(data.target).emit("offer", {
            from: socket.id,
            offer: data.offer,
        });
    });

    /******** ANSWER ********/
    socket.on("answer", (data) => {
        io.to(data.target).emit("answer", {
            from: socket.id,
            answer: data.answer,
        });
    });

    /******** ICE CANDIDATE ********/
    socket.on("ice-candidate", (data) => {
        io.to(data.target).emit("ice-candidate", {
            from: socket.id,
            candidate: data.candidate,
        });
    });

    /******** USER DISCONNECT ********/
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        socket.broadcast.emit("user-left", socket.id);
    });
});

/***************************************************
 SERVER START
***************************************************/
server.listen(4000, () => {
    console.log("Server running on http://localhost:4000");
});
