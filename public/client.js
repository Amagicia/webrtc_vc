const socket = io()
// Camera started
// New user joined
// Offer sent
// Offer received
// Answer sent
// Answer received
// ICE candidate generated
// Remote stream received
// Connection state: connected
const localVideo = document.getElementById("localVideo")
const remoteVideo = document.getElementById("remoteVideo")

let localStream
let peers = {}

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },

    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
}

async function joinRoom(){

  const roomId = document.getElementById("room").value

  console.log("Joining room:", roomId)

  localStream = await navigator.mediaDevices.getUserMedia({
    video:true,
    audio:true
  })

  console.log("Camera started")

  localVideo.srcObject = localStream

  socket.emit("join-room", roomId)

}

socket.on("user-joined", async userId => {

  console.log("New user joined:", userId)

  const pc = createPeer(userId)

  const offer = await pc.createOffer()

  await pc.setLocalDescription(offer)

  socket.emit("offer", {
    target:userId,
    offer:offer
  })

  console.log("Offer sent")

})

socket.on("offer", async data => {

  console.log("Offer received")

  const pc = createPeer(data.from)

  await pc.setRemoteDescription(data.offer)

  const answer = await pc.createAnswer()

  await pc.setLocalDescription(answer)

  socket.emit("answer", {
    target:data.from,
    answer:answer
  })

  console.log("Answer sent")

})

socket.on("answer", async data => {

  console.log("Answer received")

  await peers[data.from].setRemoteDescription(data.answer)

})

socket.on("ice-candidate", async data => {

  console.log("ICE candidate received")

  if(peers[data.from]){
    await peers[data.from].addIceCandidate(data.candidate)
  }

})

function createPeer(userId){

  const pc = new RTCPeerConnection(config)

  peers[userId] = pc

  localStream.getTracks().forEach(track=>{
    pc.addTrack(track, localStream)
  })

  pc.ontrack = event => {

    console.log("Remote stream received")

    remoteVideo.srcObject = event.streams[0]

  }

  pc.onicecandidate = event => {

    if(event.candidate){

      console.log("ICE candidate generated")

      socket.emit("ice-candidate", {
        target:userId,
        candidate:event.candidate
      })

    }

  }

  pc.onconnectionstatechange = () => {
    console.log("Connection state:", pc.connectionState)
  }

  return pc
}