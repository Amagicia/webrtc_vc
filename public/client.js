/***************************************************
 SIMPLE MULTI-PEER WEBRTC CLIENT
***************************************************/

/******** SOCKET CONNECTION ********/
const socket = io();

/******** VIDEO ELEMENTS ********/
const localVideo = document.getElementById("localVideo");
const videos = document.getElementById("videos");

/******** GLOBAL STATE ********/
let localStream;
let peers = {}; // store peer connections

let audioTrack;
let videoTrack;

let isMuted = false;
let isScreenSharing = false;

/******** STUN SERVER ********/
const config = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/***************************************************
 JOIN ROOM
***************************************************/
async function joinRoom() {
    const roomId = document.getElementById("room").value;

    if (!roomId) {
        console.log("Room ID required");
        return;
    }

    /******** START CAMERA ********/
    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
    });

    localVideo.srcObject = localStream;

    audioTrack = localStream.getAudioTracks()[0];
    videoTrack = localStream.getVideoTracks()[0];

    console.log("Camera started");

    /******** JOIN ROOM ********/
    socket.emit("join-room", roomId);
}

/***************************************************
 CREATE PEER CONNECTION
***************************************************/
function createPeer(userId) {
    const pc = new RTCPeerConnection(config);

    peers[userId] = pc;

    /******** SEND LOCAL TRACKS ********/
    localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
    });

    /******** RECEIVE REMOTE STREAM ********/

    pc.ontrack = (event) => {
        if (event.track.kind === "video") {
            addRemoteVideo(event.streams[0], userId);
        }
    };
    /******** ICE CANDIDATE ********/
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", {
                target: userId,
                candidate: event.candidate,
            });
        }
    };

    return pc;
}

/***************************************************
 ADD REMOTE VIDEO
***************************************************/
function addRemoteVideo(stream, id) {
    // prevent duplicate videos
    if (document.getElementById("video-" + id)) return;

    const wrapper = document.createElement("div");
    wrapper.className = "video-wrapper";
    wrapper.id = "video-" + id;

    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;

    const label = document.createElement("div");
    label.className = "video-label";
    label.innerText = id;

    wrapper.appendChild(video);
    wrapper.appendChild(label);

    videos.appendChild(wrapper);
}
/***************************************************
 USER JOINED
***************************************************/
socket.on("user-joined", async (userId) => {
    const pc = createPeer(userId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("offer", {
        target: userId,
        offer: offer,
    });
});

/***************************************************
 RECEIVE OFFER
***************************************************/
socket.on("offer", async (data) => {
    const pc = createPeer(data.from);

    await pc.setRemoteDescription(data.offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", {
        target: data.from,
        answer: answer,
    });
});

/***************************************************
 RECEIVE ANSWER
***************************************************/
socket.on("answer", async (data) => {
    const pc = peers[data.from];

    if (!pc) return;

    await pc.setRemoteDescription(data.answer);
});

/***************************************************
 RECEIVE ICE
***************************************************/
socket.on("ice-candidate", async (data) => {
    const pc = peers[data.from];

    if (!pc) return;

    await pc.addIceCandidate(data.candidate);
});

/***************************************************
 USER LEFT
***************************************************/
socket.on("user-left", (id) => {
    if (peers[id]) {
        peers[id].close();
        delete peers[id];
    }

    const video = document.getElementById("video-" + id);

    if (video) video.remove();
});

/***************************************************
 MUTE / UNMUTE
***************************************************/
function toggleMute() {
    isMuted = !isMuted;

    audioTrack.enabled = !isMuted;

    console.log(isMuted ? "Muted" : "Unmuted");
}

/***************************************************
 SCREEN SHARE
***************************************************/
async function toggleScreenShare() {
    if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
        });

        const screenTrack = screenStream.getVideoTracks()[0];

        replaceTrack(screenTrack);

        screenTrack.onended = stopScreenShare;

        isScreenSharing = true;
    } else {
        stopScreenShare();
    }
}

function stopScreenShare() {
    replaceTrack(videoTrack);

    isScreenSharing = false;
}

function replaceTrack(newTrack) {
    for (let id in peers) {
        const sender = peers[id]
            .getSenders()
            .find((s) => s.track.kind === "video");

        sender.replaceTrack(newTrack);
    }

    localVideo.srcObject = new MediaStream([newTrack, audioTrack]);
}

/***************************************************
 END CALL
***************************************************/
function endCall() {
    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
    }

    for (let id in peers) {
        peers[id].close();
    }

    peers = {};

    videos.innerHTML = "";

    localVideo.srcObject = null;
}
