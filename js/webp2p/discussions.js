class Discussions {
	constructor(ENS_name) {
		this.topics = {};
		this.name = ENS_name;
	}
}

Discussions.prototype.newTopic = function(author, content, timestamp = null) {
	var msg = new Topic(author, content, timestampe);
	var msg_id = md5(JSON.stringify(msg));
	topis[msg_id] = msg;
	
	return msg;
}

Discussions.prototype.receivedTopic = function(title, content, author) {
	// write topic to topics
	// broadcast topic to peers that don't have it yet
}

class Message {	
	constructor(author, content, topic, timestamp = null) {
		this.author = author;
		this.content = content;
		this.topic = topic;
		if (timestamp == null)
			this.timestamp = Date.now();
	}
}

class P2PNetwork {
	constructor () {
		// this.peers = peers;
		this.received_messages = {};
		//this.id = id;
	}
}

P2PNetwork.prototype.startMessage = function (msg) {
	let msg_to_send = new Message(id.pubKey, msg, "general");
	msg_id = md5(JSON.stringify(msg_to_send));
	this.received_messages[msg_id] = id.pubKey;
	this.broadcastMessage(msg_to_send);
}

P2PNetwork.prototype.receivedMessage = function(msg, from) {
	msg_id = md5(JSON.stringify(msg));
	if (!(msg_id in this.received_messages)) {
		this.received_messages[msg_id] = msg.author;
		console.log("from: ", msg.author, ", msg: ", msg);
		this.broadcastMessage(msg);
	}	
}

P2PNetwork.prototype.broadcastMessage = function(msg) {
	msg_id = md5(JSON.stringify(msg));
	for (var i in Peers){
    if (Peers[i].peer_pubkey != msg.author && 
    		Peers[i].peer_pubkey != this.received_messages[msg_id]) {
			msg_to_send = {"from": id.pubKey, "msg": msg};
			console.log("msg: ", msg_to_send)
			Peers[i].dataChannel.send(JSON.stringify(msg_to_send));
    }
	}
}
