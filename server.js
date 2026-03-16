const express = require("express")
const http = require("http")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.static("public"))

let rooms = {}

io.on("connection", socket => {

  console.log("Client connected:", socket.id)

  socket.on("host", room => {

    console.log("HOST created room:", room)

    rooms[room] = {
      host: socket.id,
      viewers: []
    }

  })

  socket.on("join", room => {

    console.log("Viewer joining:", room)

    if (!rooms[room]) {
      console.log("Room not found")
      return
    }

    rooms[room].viewers.push(socket.id)

    socket.join(room)

    io.to(rooms[room].host).emit("viewer-joined", socket.id)

  })

  socket.on("offer", ({viewerId, offer}) => {

    console.log("Offer sent to viewer:", viewerId)

    io.to(viewerId).emit("offer", {
      offer,
      hostId: socket.id
    })

  })

  socket.on("answer", ({hostId, answer}) => {

    console.log("Answer sent to host")

    io.to(hostId).emit("answer", {
      answer,
      viewerId: socket.id
    })

  })

  socket.on("candidate", data => {

    console.log("ICE candidate forwarded")

    io.to(data.target).emit("candidate", {
      candidate: data.candidate,
      from: socket.id
    })

  })

  socket.on("disconnect", () => {

    console.log("Client disconnected:", socket.id)

  })

})

server.listen(3000, () =>
  console.log("Server running on port 3000")
)