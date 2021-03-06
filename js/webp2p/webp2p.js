var		webRTC_data_index = 0; // index of webRTC data sent
var 	Peers = {};
var 	EIDs = {};
var		Peers_pubkey = {};
var   ChatP2P = new P2PNetwork();
var		discussions = new Discussions("Blabber Mouthers");
var   EID;
var		portScoketIO;
var 	messagesCollection = []; //collect all messages send and received

//temp variable
var messages = {};
document.getElementById("Message").disabled = true;

//const configuration = {iceServers: [{urls: 'stun:stun.stunprotocol.org'}]};

browser.storage.local.get('EID').then(function(item) {
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
document.getElementById("Message")
    .addEventListener("keyup", function(event) {
    if (event.keyCode === 13) {
        document.getElementById("sendmessage").click();
    }
    event.preventDefault();
});

/* socket.io part */
function connectServer(index, peer) {		

	var datatoSend = {
		"type": "connection_request",
		"from_id": index,
		"from": EID.pubKey, 
		"relay": peer.relay,
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
			    Peers_pubkey[m.data.from] = m.data.to_id;
			    Peers[m.data.to_id].peer_pubkey = m.data.from;
					Peers[m.data.to_id].remoteIndex = m.data.from_id; 
					Peers[m.data.to_id].EID = m.data.EID.ENS;
					EIDs[m.data.EID.ENS] = m.data.EID;
					Peers[m.data.to_id].setRemoteData(m.data.msg);
				// }
				break;
			case "connection_request":
					newWebRTCConnection(returnWebRTCDataToPeer, "wait", m.data.relay,  m.data);
				break;
			case "sign":
				message = JSON.stringify({data: m.data, signature: m.signature});
				var messageID = md5(message);
				messages[messageID] = true;
				messagesCollection[messagesCollection.length] = message; 
				for (var peer in Peers) {
    			if (Peers[peer].dataChannel && (Peers[peer].dataChannel.readyState == "open"))
	    			Peers[peer].dataChannel
						.send(message);
    		}
				break;
			case "verifySignature":
				console.log("verified: ", m);
				if (m.verified) {
					if (m.verificationNeeded)
						EIDs[m.EID.ENS] = m.EID;
					
					data = JSON.parse(m.data);
					EIDName = m.EID.name;
					document.getElementById("ChatBox").innerHTML = "<font color='red'>" + EIDName + "</font>: " + data.data.message + "<br>" + document.getElementById("ChatBox").innerHTML;
					messagesCollection[messagesCollection.length] = JSON.stringify({data: data.data, signature: m.signature});
		  		forwardMessage(JSON.stringify({data: data.data, signature: m.signature}), data.from);
		  	}
				break;
			default:
				console.log("error in switch");
  	}
	});  
}

function newWebRTCConnection(callback = null, role="init", relay=false, peer_data = null) {
  webRTC_data_index = webRTC_data_index + 1;
	var i = webRTC_data_index; //using 'i' for brevity of code
  
	if (role=="init") {
		if (peer_data == null)
			Peers[i] = new Peer(i, callback, role, relay);
		else
			Peers[i] = new Peer(i, callback, role, relay, null, peer_data.peer_pubkey, peer_data.EID);

		Peers[i].dataChannel = Peers[i].webRTC.createDataChannel('sendDataChannel', null);  

	  Peers[i].dataChannel.onopen = function(e) {
			onSendChannelStateChange(e, i);
		};
  	Peers[i].dataChannel.onclose = function(e) {
			onSendChannelStateChange(e, i);
		};
  	Peers[i].dataChannel.onmessage = function(e) {
			onReceiveMessage(e, i);
		}
	} else if (role=="wait") {
		// add pubkey of peer to index
		Peers_pubkey[peer_data.from] = i;

		// create webRTC object
		Peers[i] = new Peer(i, callback, role, relay, peer_data.from_id, peer_data.from, peer_data.EID);
		Peers[i].webRTC.ondatachannel = function(e) {
			onDataChannel(e, i);
		}
		Peers[i].setRemoteData(peer_data.msg);
	}
}

function onDataChannel(e, i) {
  Peers[i].dataChannel = e.channel;
  Peers[i].dataChannel.onopen = function(e) {
			onSendChannelStateChange(e, i);
		}
  Peers[i].dataChannel.onclose = function(e) {
			onSendChannelStateChange(e, i);
		};
  Peers[i].dataChannel.onmessage = function(e) {
			onReceiveMessage(e, i);
		}
}

function onSendChannelStateChange(ev, i) {
	console.log('Send channel state is: ' + JSON.stringify(ev));
	if (document.getElementById("Message").disabled == true && Peers[i].role == "init")
		Peers[i].dataChannel.send("sendArchive");
	else
		document.getElementById("Message").disabled = false;
 }

function onReceiveMessage(e, i) {
	if (e.data == "noMessages")
		document.getElementById("Message").disabled = false;
	else if (e.data == "sendArchive")
		sendHistory(i);
	else {
		var data = JSON.parse(e.data);
		if (data.type == "archiveEnd") 
			document.getElementById("Message").disabled = false;

		var msgData = data.data;
		var msgSignature = data.signature;
		messageID = md5(e.data);
		if ((msgData.url == ENSname) && (!messages[messageID])) {
			messages[messageID] = true;
			var verifyEID = (msgData.EID.ENS in EIDs) ? false : true;
			var authorEID = verifyEID ? msgData.EID : EIDs[msgData.EID.ENS];
		  	portScoketIO.postMessage({action: "verifySignature", data: e.data, 
		  														signature: msgSignature, EID: authorEID, verificationNeeded: verifyEID});
		}
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

function sendNewWebRTCDataToPeer(index, peer) {
	var datatoSend = {
		"type": "connection_request",
		"to": peer.peer_pubkey,
		"from_id": index,
		"from": EID.pubKey, 
		"EID": EID,
		"relay": peer.relay,
		"msg": peer.localSTUNICEData
	};

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
	          "<font color='blue'> me:</font> " + msg 
	          + "<br>" 
	          + document.getElementById("ChatBox").innerHTML;
	    document.getElementById("Message").value = "";
  		document.getElementById("Message").focus();
		}

		portScoketIO.postMessage({action: "sign", data: {url: ENSname, message: msg, EID: EID}});

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

// send all messagesCollection to Peer i
function sendHistory(i) {
	if (messagesCollection.length == 0)
		Peers[i].dataChannel.send("noMessages");
messagesCollection.forEach(function(message, index) {
	message = JSON.parse(message);
	if (index+1 == messagesCollection.length) 
		message["type"] = "archiveEnd";
	Peers[i].dataChannel.send(JSON.stringify(message));
	});
}

// Aux functions
function setText (name, val) { document.getElementsByName(name)[0].innerText = val }
