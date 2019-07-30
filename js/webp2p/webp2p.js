var		webRTC_data_index = 0; // index of webRTC data sent
var 	Peers = {};
var		Peers_pubkey = {};
var   ChatP2P = new P2PNetwork();
var		discussions = new Discussions("Blabber Mouthers");
var   EID;
var		portScoketIO;


//temp variable
var messages = {};

const configuration = {iceServers: [{urls: 'stun:stun.stunprotocol.org'}]};

browser.storage.local.get('EID').then(function(item) {
	var ey = "coscos";
	var x = document.getElementById("almonit_title");
	x.innerHTML = ey;
  if (Object.entries(item).length != 0) {
    item = item.EID;
    EID = {
      "ENS": item.ENS,
      "name": item.name,
      "pubKey": item.pubKey
    }
  }
	newWebRTCConnection(connectServer);
});

document.getElementById("sendmessage").addEventListener("click", sendMessage)

/* socket.io part */
function connectServer(index, peer) {		

	var datatoSend = {
		"type": "connection_request",
		"from_id": index,
		"from": EID.pubKey, 
		"EID": EID,
		"msg": peer.localSTUNICEData
	};

	portScoketIO = browser.runtime.connect({name:"portFromWebP2P"});

	portScoketIO.postMessage({connectSocketIO: true, data: datatoSend, action: "init"});

	portScoketIO.onMessage.addListener(function(m) {
  	switch (m.type) {
  		case "cancel_request":
  			console.log("cancel_request: ", m);
				delete Peers[m.data.from_id];
  			break;
  		case "return_webRTC_data":
		  	console.log("return_webRTC_data: ", m);
		  	// if (verifyEID(m.data.EID)) {
			    Peers[m.data.to_id].peer_pubkey = m.data.from;
					Peers[m.data.to_id].remoteIndex = m.data.from_id; 
					Peers[m.data.to_id].EID = m.data.EID;
					Peers[m.data.to_id].setRemoteData(m.data.msg);
				// }
				break;
			case "connection_request":
				// var verified = verifyEID(m.data.EID);
				// if (verified)
					newWebRTCConnection(returnWebRTCDataToPeer, "wait", m.data);
				break;
			case "sign":
				console.log(m);
				for (var peer in Peers) {
    			if (Peers[peer].dataChannel && (Peers[peer].dataChannel.readyState == "open"))
	    			Peers[peer].dataChannel
						.send(JSON.stringify({data: m.data, signature: m.signature}));
    		}
				break;
			case "verifySignature":
				if (m.verified) {
					data = JSON.parse(m.data);
					document.getElementById("ChatBox").innerHTML = data.data.message + "<br>" + document.getElementById("ChatBox").innerHTML;
		  		forwardMessage(JSON.stringify({data: m.data, signature: m.signature}), data.from);
		  	}
				break;
			default:
				console.log("error in switch");
  	}
	});  
}

function newWebRTCConnection(callback = null, role="init", peer_data = null) {
  webRTC_data_index = webRTC_data_index + 1;
	var i = webRTC_data_index; //using 'i' for brevity of code
  
	if (role=="init") {
		Peers[i] = new Peer(i, callback, role);
		Peers[i].dataChannel = Peers[i].webRTC.createDataChannel('sendDataChannel', null);  

	  Peers[i].dataChannel.onopen = onSendChannelStateChange;
  	Peers[i].dataChannel.onclose = onSendChannelStateChange;
  	Peers[i].dataChannel.onmessage = function(e) {
			onReceiveMessage(e, i);
		}
	} else if (role=="wait") {
		// add pubkey of peer to index
		Peers_pubkey[peer_data.from] = i;

		// create webRTC object
		Peers[i] = new Peer(i, callback, role, peer_data.from_id, peer_data.from, peer_data.EID);
		Peers[i].webRTC.ondatachannel = function(e) {
			onDataChannel(e, i);
		}
		Peers[i].setRemoteData(peer_data.msg);
	}
}

function onDataChannel(e, i) {
  Peers[i].dataChannel = e.channel;
  Peers[i].dataChannel.onopen = onSendChannelStateChange;
  Peers[i].dataChannel.onclose = onSendChannelStateChange;
  Peers[i].dataChannel.onmessage = function(e) {
			onReceiveMessage(e, i);
		}
}

function onSendChannelStateChange(ev) {
	console.log('Send channel state is: ' + ev);
 }

function onReceiveMessage(e, i) {
	var data = JSON.parse(e.data);
	var msgData = data.data;
	var msgSignature = data.signature;
	messageID = md5(e.data);
	if ((msgData.url == ENSname) && (!messages[messageID])) {
		messages[messageID] = true;
	  portScoketIO.postMessage({action: "verifySignature", data: e.data, signature: msgSignature, pubKey: Peers[i].EID.pubKey});
	}
}


function returnWebRTCDataToPeer(index, peer) {	
	var datatoSend = {
		"type": "return_webRTC_data",
		"to_id": peer.remoteIndex,
		"from_id": index,
		"from": EID.pubKey, 
		"to":	peer.peer_pubkey,
		"EID": EID,
		"msg": peer.localSTUNICEData
	};
	console.log("send to node");
	portScoketIO.postMessage({action: "send_to_node", datatoSend});
}

function msgFromServer(message) {
	console.log("message: ", message);
}

function handleError(e) {
    console.log('error: ' + e);
}

function sendMessage(e) {
	  msg = document.getElementById("Message").value;
	  if (msg !== "") {
	    document.getElementById("ChatBox").innerHTML = 
	          "<font color='blue'>" + msg + "</font>"
	          + "<br>" 
	          + document.getElementById("ChatBox").innerHTML;
	    document.getElementById("Message").value = "";
  		document.getElementById("Message").focus();
		}

		portScoketIO.postMessage({action: "sign", data: {url: ENSname, message: msg, from: EID.pubKey}});

    // for (var peer in Peers) {
    // 	if (Peers[peer].dataChannel && (Peers[peer].dataChannel.readyState == "open"))
    // 		Peers[peer].dataChannel.send(JSON.stringify({url: ENSname, message: msg }));
    // }
}

function forwardMessage(message, besides) {
    for (var peer in Peers) {
    	if ((parseInt(peer) != besides) && Peers[peer].dataChannel && (Peers[peer].dataChannel.readyState == "open"))
    		Peers[peer].dataChannel.send(message);
    }
}

// Aux functions
function setText (name, val) { document.getElementsByName(name)[0].innerText = val }