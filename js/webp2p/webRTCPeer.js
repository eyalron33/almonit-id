class Peer {

	constructor(index, callback=null, role="init", relay = false, remote_index = null, peer_pubkey = null, EID = null) {
		var configuration2 = {RTCIceTransportPolicy: "relay", iceServers: [
		{urls: 'stun:stun.stunprotocol.org'}, 
		{urls: 'turn:95.179.128.10?transport=udp', username: 'test', credential: 'test'},
		{urls: 'turn:95.179.128.10?transport=tcp', username: 'test', credential: 'test'} ]};
		// var configuration2 = {iceServers: [{urls: 'stun:stun.stunprotocol.org'}, 
		// {urls: 'turn:192.168.0.52?transport=udp', username: 'test', credential: 'test'},
		// {urls: 'turn:192.168.0.52?transport=tcp', username: 'test', credential: 'test'} ]};
		// var configuration2 = {iceServers: [
		// {urls: 'stun:stun.stunprotocol.org'}, 
		// {urls: 'turn:3.221.170.12?transport=udp', username: 'test', credential: 'test'},
		// {urls: 'turn:3.221.170.12?transport=tcp', username: 'test', credential: 'test'} ]};

		this.dataChannel 			= null;
		this.remoteData				= null;
	
  	this.localSTUNICEData = {
  	  STUN: "",
  	  ICE: new Array()
  	};

    this.index  = index;
		this.remoteIndex	= remote_index;
    this.peer_pubkey = peer_pubkey;
    this.EID = EID;
    this.role 	= role;
    
		// if relay=true, only ice candidates of relay type are considered.
		// This solves a bug: Firefox ignores relay candidates if one party have other options
    this.relay = relay;
		
		this.webRTC = new RTCPeerConnection(configuration2);

	  this.webRTC.onicecandidate =  function(e) {
			console.log("ice candidate"); 
			handleICECandidateEvent(e, index, callback);
		}
	  
		this.webRTC.onnegotiationneeded = function(e) {
			handleNegotiationNeededEvent(e, index);
		}

		this.webRTC.oniceconnectionstatechange = function(e) {
			handleICEConnectionStateChangeEvent(e, index);
		}	

	  this.webRTC.onicegatheringstatechange = handleICEGatheringStateChangeEvent;
	  this.webRTC.onsignalingstatechange = handleSignalingStateChangeEvent;

	}
}

Peer.prototype.setRemoteData = function(data) {
     var STUNcandidate = JSON.parse(data.STUN);
		console.log("outside wait");		

    if (this.role == "wait") {
			this.webRTC.setRemoteDescription(STUNcandidate);
				console.log("about to answer");
			this.webRTC.createAnswer().then(answer => {
				this.localSTUNICEData.STUN  = JSON.stringify(answer);
        this.webRTC.setLocalDescription(answer);
        this.SetRemoteIceCandidates(data.ICE);
      })
      .catch(reportError);
    } else if (this.role == "init") {
      this.webRTC.setRemoteDescription(STUNcandidate);
      this.SetRemoteIceCandidates(data.ICE);
    } 
}

Peer.prototype.SetRemoteIceCandidates = function(ICEcadndidatesData) {
  for (var i in ICEcadndidatesData)  {
    let remoteIceCandidate = JSON.parse(ICEcadndidatesData[i]); 

    this.webRTC.addIceCandidate(remoteIceCandidate)
      .then(function() {
        console.log("---> Added ice candidate successfully");
      })
      .catch(reportError);   
  }
}

function handleICECandidateEvent (e, index, callback) {
	console.log("handleICECandidateEvent: " + e.candidate);
  if (e.candidate && 
  		(!Peers[index].relay || e.candidate.candidate.indexOf("relay") > -1)) {
	// if (e.candidate) {
		Peers[index].localSTUNICEData.ICE.push(JSON.stringify(e.candidate));

		console.log("ice candidate state: " + e.target.iceGatheringState);
	}
	if (e.target.iceGatheringState === 'complete')
				callback(index, Peers[index]); 
}

function handleNegotiationNeededEvent(e, i) {
	console.log("*** Negotiation needed: " + e + "indenx: " + i);
	
	console.log("---> Creating offer");
	Peers[i].webRTC.createOffer().then(function(offer) {
	  console.log("---> Creating new description object to send to remote peer");
	  console.log("Offer: " + JSON.stringify(offer));
	  Peers[i].localSTUNICEData.STUN = JSON.stringify(offer); //create STUNICE object
	  return Peers[i].webRTC.setLocalDescription(offer);
	})
	.then(function() {
	  console.log("---> Kind of sending offer to remote peer");
	})
	.catch(reportError);
} 

function handleICEConnectionStateChangeEvent(e, i) {
	console.log("ice state: ", Peers[i].webRTC.iceConnectionState);
	if (Peers[i].webRTC.iceConnectionState=="failed" && Peers[i].role == "init") {
		console.log("FAILED");
		var peer = Peers[i];
		delete Peers[i];
		newWebRTCConnection(sendNewWebRTCDataToPeer, "init", true, peer);
	}
}

function handleICEGatheringStateChangeEvent(e) {console.log("handleICEGatheringStateChangeEvent");}

function handleSignalingStateChangeEvent(e) {
	e = JSON.stringify(e);
	console.log("Signaling State: " + e);
}

function genericEvent(e) {
	e = JSON.stringify(e);
	console.log("Events: " + e);
}
