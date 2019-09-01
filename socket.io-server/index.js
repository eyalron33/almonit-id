// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = 1993;

class Node {
	constructor(pubkey, socketID) {
		this.socketID = socketID;
		this.pubkey 	= pubkey;	
		this.turn = false;
	}
}

var names = {}; //pubkey -> node
var inverse_names={}; //socket.id -> pubkey
var connectCounter = 0;

function connect_to_random_node(data) {
	var random_key = "";

	do { 
		random_key = randomKey(names);
		console.log("in r key loop: " + random_key);
	} while (random_key == data.from);
	data["to"] = random_key;
	transfer_data(data);
}

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});


io.on('connection', function (socket) {

	connectCounter++; 
	console.log("counter connect: " + connectCounter);

	socket.on('disconnect', function() { 
		connectCounter--; 
		delete names[inverse_names[socket.id]];
		console.log("counter disconnect: " + connectCounter);
	});

	socket.on('init', function (data) {
		data = JSON.parse(data);
		console.log("init: ", data);
		if (!(data.from in names)) { 
			var new_node = new Node(data.from, socket.id);
			names[data.from] = new_node;
			inverse_names[socket.id] = data.from;
		}
	
		if (connectCounter == 1) {
			cancel_all_requests(data);
		} else {
			connect_to_random_node(data);
		}

		console.log("Got name: " + data);
	});

  socket.on('send_to_node', function (data) {
		console.log("got data before sending: " + data);
		transfer_data(JSON.parse(data));
  });

  // if client emits 'data', server broadcasts to all except sender
  socket.on('data', function (data) {
  	console.log("Got data: " + data)
    socket.broadcast.emit('data', data);
  });

});


	function transfer_data(data) {
		io.clients().sockets[names[data.to].socketID].emit(data.type, JSON.stringify(data));
	}

	function cancel_all_requests(data) {
		io.clients().sockets[names[data.from].socketID].emit("cancel_request", JSON.stringify(data));
	}

// auxillary functions, move to a separate files/package
var randomKey = function (obj) {
    var keys = Object.keys(obj)
    return keys[ keys.length * Math.random() << 0];
};
