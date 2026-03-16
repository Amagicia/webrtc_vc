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

  socket.on("join-room", roomId => {

    console.log("Joining room:", roomId)

    if(!rooms[roomId]) rooms[roomId] = []

    rooms[roomId].push(socket.id)
    socket.join(roomId)

    socket.to(roomId).emit("user-joined", socket.id)

  })

  socket.on("offer", data => {
    io.to(data.target).emit("offer", {
      offer:data.offer,
      from:socket.id
    })
  })

  socket.on("answer", data => {
    io.to(data.target).emit("answer", {
      answer:data.answer,
      from:socket.id
    })
  })

  socket.on("ice-candidate", data => {
    io.to(data.target).emit("ice-candidate", {
      candidate:data.candidate,
      from:socket.id
    })
  })

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id)
  })

})

const PORT = process.env.PORT || 4000

server.listen(PORT, () =>
  console.log("Server running on port", PORT)
)