/*********************************************************
 SIMPLE WEBRTC CLIENT
 Features:
 - Camera & microphone
 - Multi-peer connections
 - Offer / Answer signaling
 - ICE candidate exchange
 - Mute / Unmute
 - Screen share
 - End call
**********************************************************/

/**************** SOCKET CONNECTION ****************/
const socket = io();
console.log("[INIT] Socket connected");

/**************** VIDEO ELEMENTS ****************/
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

/**************** GLOBAL STATE ****************/
let localStream = null;
let peers = {};

let audioTrack = null;
let videoTrack = null;

let isMuted = false;
let isScreenSharing = false;

/**************** STUN + TURN CONFIG ****************/
const config = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },

        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
        },

        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
        }
    ]
};


/*********************************************************
 JOIN ROOM
**********************************************************/
async function joinRoom() {

    const roomId = document.getElementById("room").value;

    if (!roomId) {
        console.log("[ERROR] Room ID required");
        return;
    }

    try {

        /******** START CAMERA ********/
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        localVideo.srcObject = localStream;

        audioTrack = localStream.getAudioTracks()[0];
        videoTrack = localStream.getVideoTracks()[0];

        console.log("[MEDIA] Camera started");

        /******** JOIN ROOM ********/
        socket.emit("join-room", roomId);

        console.log("[ROOM] Joined:", roomId);

    } catch (err) {

        console.log("[ERROR] Media access failed:", err);

    }
}


/*********************************************************
 CREATE PEER CONNECTION
**********************************************************/
function createPeer(userId) {

    console.log("[PEER] Creating connection:", userId);

    const pc = new RTCPeerConnection(config);
    peers[userId] = pc;

    /******** SEND LOCAL TRACKS ********/
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    /******** RECEIVE REMOTE STREAM ********/
    pc.ontrack = (event) => {
        console.log("[MEDIA] Remote stream received");
        remoteVideo.srcObject = event.streams[0];
    };

    /******** ICE CANDIDATES ********/
    pc.onicecandidate = (event) => {

        if (event.candidate) {

            socket.emit("ice-candidate", {
                target: userId,
                candidate: event.candidate
            });

            console.log("[ICE] Candidate sent");
        }
    };

    /******** DEBUG STATES ********/
    pc.onconnectionstatechange = () => {
        console.log("[STATE]", pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
        console.log("[ICE STATE]", pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
        console.log("[SIGNAL STATE]", pc.signalingState);
    };

    return pc;
}


/*********************************************************
 USER JOINED ROOM
**********************************************************/
socket.on("user-joined", async (userId) => {

    const pc = createPeer(userId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("offer", {
        target: userId,
        offer: offer
    });

    console.log("[WEBRTC] Offer sent");

});


/*********************************************************
 RECEIVE OFFER
**********************************************************/
socket.on("offer", async (data) => {

    const pc = createPeer(data.from);

    await pc.setRemoteDescription(data.offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", {
        target: data.from,
        answer: answer
    });

    console.log("[WEBRTC] Answer sent");

});


/*********************************************************
 RECEIVE ANSWER
**********************************************************/
socket.on("answer", async (data) => {

    const pc = peers[data.from];

    if (!pc) return;

    await pc.setRemoteDescription(data.answer);

    console.log("[WEBRTC] Remote description updated");

});


/*********************************************************
 RECEIVE ICE CANDIDATE
**********************************************************/
socket.on("ice-candidate", async (data) => {

    const pc = peers[data.from];

    if (!pc) return;

    await pc.addIceCandidate(data.candidate);

    console.log("[ICE] Candidate added");

});


/*********************************************************
 MUTE / UNMUTE
**********************************************************/
function toggleMute() {

    if (!audioTrack) return;

    isMuted = !isMuted;

    audioTrack.enabled = !isMuted;

    console.log(isMuted ? "[AUDIO] Muted" : "[AUDIO] Unmuted");

}


/*********************************************************
 SCREEN SHARE
**********************************************************/
async function toggleScreenShare() {

    if (!isScreenSharing) {

        try {

            const screenStream =
                await navigator.mediaDevices.getDisplayMedia({
                    video: true
                });

            const screenTrack =
                screenStream.getVideoTracks()[0];

            replaceVideoTrack(screenTrack);

            screenTrack.onended = stopScreenShare;

            isScreenSharing = true;

            console.log("[SCREEN] Sharing started");

        } catch (err) {

            console.log("[ERROR] Screen share failed");

        }

    } else {

        stopScreenShare();

    }
}


function stopScreenShare() {

    replaceVideoTrack(videoTrack);

    isScreenSharing = false;

    console.log("[SCREEN] Sharing stopped");

}


function replaceVideoTrack(newTrack) {

    for (const id in peers) {

        const sender = peers[id]
            .getSenders()
            .find(s => s.track?.kind === "video");

        if (sender) sender.replaceTrack(newTrack);
    }

    localVideo.srcObject =
        new MediaStream([newTrack, audioTrack]);

}


/*********************************************************
 END CALL
**********************************************************/
function endCall() {

    console.log("[CALL] Ending call");

    if (localStream) {

        localStream.getTracks().forEach(track => track.stop());

    }

    for (const id in peers) {

        peers[id].close();

    }

    peers = {};

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;

}