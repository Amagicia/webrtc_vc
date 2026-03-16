const socket = io()

const localVideo = document.getElementById("local")
const remoteVideo = document.getElementById("remote")

let localStream
let peers = {}

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
}

async function startHost(){

  const room = document.getElementById("room").value

  console.log("HOST STARTING")

  localStream = await navigator.mediaDevices.getUserMedia({
    video:true,
    audio:true
  })

  console.log("Camera started")

  localVideo.srcObject = localStream

  socket.emit("host", room)

}

async function joinViewer(){

  const room = document.getElementById("room").value

  console.log("VIEWER joining room:", room)

  socket.emit("join", room)

}

socket.on("viewer-joined", async viewerId => {

  console.log("New viewer:", viewerId)

  const pc = new RTCPeerConnection(config)

  peers[viewerId] = pc

  localStream.getTracks().forEach(track=>{
    pc.addTrack(track, localStream)
  })

  pc.onicecandidate = e => {

    if(e.candidate){

      console.log("ICE candidate generated")

      socket.emit("candidate",{
        target: viewerId,
        candidate: e.candidate
      })

    }

  }

  const offer = await pc.createOffer()

  await pc.setLocalDescription(offer)

  console.log("Offer created")

  socket.emit("offer",{
    viewerId,
    offer
  })

})

socket.on("offer", async data => {

  console.log("Offer received from host")

  const pc = new RTCPeerConnection(config)

  peers[data.hostId] = pc

  pc.ontrack = e => {

    console.log("Remote stream received")

    remoteVideo.srcObject = e.streams[0]

  }

  pc.onicecandidate = e => {

    if(e.candidate){

      socket.emit("candidate",{
        target:data.hostId,
        candidate:e.candidate
      })

    }

  }

  await pc.setRemoteDescription(data.offer)

  const answer = await pc.createAnswer()

  await pc.setLocalDescription(answer)

  console.log("Answer created")

  socket.emit("answer",{
    hostId:data.hostId,
    answer
  })

})

socket.on("answer", async data => {

  console.log("Answer received by host")

  await peers[data.viewerId].setRemoteDescription(data.answer)

})

socket.on("candidate", async data => {

  console.log("ICE candidate received")

  await peers[data.from].addIceCandidate(data.candidate)

})