/*********************************************************
 SIMPLE WEBRTC CLIENT
 Handles:
 - Camera
 - Peer connections
 - Offer/Answer exchange
 - ICE candidate exchange
 - Socket signaling
**********************************************************/

/************* SOCKET CONNECTION *************/
const socket = io();
console.log("[INIT] Socket connected");

/************* VIDEO ELEMENTS *************/
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

/************* GLOBAL STATE *************/
let localStream = null;
let peers = {}; // store peer connections by userId

/************* STUN + TURN CONFIG *************/
const config = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302",
        },
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
    ],
};

/*********************************************************
 STEP 1: JOIN ROOM
**********************************************************/
async function joinRoom() {
    const roomId = document.getElementById("room").value;

    if (!roomId) {
        console.log("[ERROR] Room ID missing");
        return;
    }

    console.log("[ROOM] Joining room:", roomId);

    try {
        /************* START CAMERA *************/
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });

        console.log("[MEDIA] Camera and microphone started");

        localVideo.srcObject = localStream;

        /************* NOTIFY SERVER *************/
        socket.emit("join-room", roomId);

        console.log("[SIGNAL] Join-room event sent");
    } catch (error) {
        console.log("[ERROR] Camera access failed:", error);
    }
}

/*********************************************************
 STEP 2: CREATE PEER CONNECTION
**********************************************************/
function createPeer(userId) {
    console.log("[PEER] Creating peer connection for:", userId);

    const pc = new RTCPeerConnection(config);

    peers[userId] = pc;

    /************* ADD LOCAL STREAM TRACKS *************/
    localStream.getTracks().forEach((track) => {
        console.log("[MEDIA] Sending track:", track.kind);

        pc.addTrack(track, localStream);
    });

    /************* RECEIVE REMOTE STREAM *************/
    pc.ontrack = (event) => {
        console.log("[MEDIA] Remote stream received");

        remoteVideo.srcObject = event.streams[0];
    };

    /************* ICE CANDIDATE GENERATION *************/
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("[ICE] Candidate generated");

            socket.emit("ice-candidate", {
                target: userId,
                candidate: event.candidate,
            });
        }
    };

    /************* CONNECTION STATE DEBUG *************/
    pc.onconnectionstatechange = () => {
        console.log("[STATE] Connection state:", pc.connectionState);
    };

    /************* ICE STATE DEBUG *************/
    pc.oniceconnectionstatechange = () => {
        console.log("[ICE STATE]:", pc.iceConnectionState);
    };

    /************* SIGNALING STATE *************/
    pc.onsignalingstatechange = () => {
        console.log("[SIGNAL STATE]:", pc.signalingState);
    };

    return pc;
}

/*********************************************************
 STEP 3: WHEN NEW USER JOINS ROOM
**********************************************************/
socket.on("user-joined", async (userId) => {
    console.log("[ROOM] New user joined:", userId);

    const pc = createPeer(userId);

    /************* CREATE OFFER *************/
    const offer = await pc.createOffer();

    console.log("[WEBRTC] Offer created");

    await pc.setLocalDescription(offer);

    console.log("[WEBRTC] Local description set");

    /************* SEND OFFER *************/
    socket.emit("offer", {
        target: userId,
        offer: offer,
    });

    console.log("[SIGNAL] Offer sent");
});

/*********************************************************
 STEP 4: RECEIVE OFFER
**********************************************************/
socket.on("offer", async (data) => {
    console.log("[SIGNAL] Offer received from:", data.from);

    const pc = createPeer(data.from);

    /************* SET REMOTE OFFER *************/
    await pc.setRemoteDescription(data.offer);

    console.log("[WEBRTC] Remote description set");

    /************* CREATE ANSWER *************/
    const answer = await pc.createAnswer();

    console.log("[WEBRTC] Answer created");

    await pc.setLocalDescription(answer);

    /************* SEND ANSWER *************/
    socket.emit("answer", {
        target: data.from,
        answer: answer,
    });

    console.log("[SIGNAL] Answer sent");
});

/*********************************************************
 STEP 5: RECEIVE ANSWER
**********************************************************/
socket.on("answer", async (data) => {
    console.log("[SIGNAL] Answer received from:", data.from);

    if (peers[data.from]) {
        await peers[data.from].setRemoteDescription(data.answer);

        console.log("[WEBRTC] Remote description updated");
    }
});

/*********************************************************
 STEP 6: RECEIVE ICE CANDIDATES
**********************************************************/
socket.on("ice-candidate", async (data) => {
    console.log("[ICE] Candidate received");

    if (peers[data.from]) {
        await peers[data.from].addIceCandidate(data.candidate);

        console.log("[ICE] Candidate added");
    }
});
