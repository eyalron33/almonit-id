importJS('js/multihashes-min');
importJS('js/main');
importJS('js/metrics');
importJS('js/socket.io');
importJS('js/normalize-url');
importJS('js/sha3.min');
importJS('js/bls/bls_c');
importJS('js/bls/bls');

/**
 * settings
 */
var localENS = {}; // a local ENS of all names we discovered
var ensDomain = ''; // domain in current call
var ipfsGateway = false;
const PAGE_404 = browser.runtime.getURL('pages/error.html');
const PAGE_SETTINGS = browser.runtime.getURL('pages/settings.html');
var portScoketIO;
var socket;
var EID;

function connected(p) {
  portScoketIO = p;
  portScoketIO.onMessage.addListener(function(m) {
  	switch (m.action) {
  		case "init":
	    	//var server = "http://127.0.0.1:1992";
	    	var server = "http://95.179.128.10:1992";
	  		socket = io.connect(server);

	  		var data = m.data;
	  		socket.emit(m.action, JSON.stringify(data));

		  	socket.on('cancel_request', function(data) {
					dataReceived = JSON.parse(data);
					portScoketIO.postMessage({type: 'cancel_request', data: dataReceived});
				});

				socket.on('return_webRTC_data', function(data) {
					dataReceived = JSON.parse(data);
					if (verifyEID(dataReceived.EID)) {
						portScoketIO.postMessage({type: 'return_webRTC_data', data: dataReceived});
					}
				});

				socket.on('connection_request', function (data) {
					dataReceived = JSON.parse(data);
					if (verifyEID(dataReceived.EID)) {
						portScoketIO.postMessage({type: 'connection_request', data: dataReceived});
					}
				});
				break;
			case "sign":
					{
					let signature = EID.secKey.sign(JSON.stringify(m.data));
					portScoketIO.postMessage({type: 'sign', data: m.data, signature: signature.serializeToHexStr()});
					}
				break;
			case "verifySignature": {
					var pubKey = bls.deserializeHexStrToPublicKey(m.pubKey);
					let signature = bls.deserializeHexStrToSignature(m.signature);
					messageData = JSON.parse(m.data);
	    		var verifiedSignature = pubKey.verify(signature, JSON.stringify(messageData.data));
					portScoketIO.postMessage({type: 'verifySignature',  data: m.data, signature: m.signature, verified: verifiedSignature});
					}
				break;
			default:
				console.log(m);
				socket.emit(m.action, JSON.stringify(m.datatoSend));	
		}
  });
}

browser.runtime.onConnect.addListener(connected);

// load plugin settings
browser.storage.local.get('settings').then(loadSettingsSetSession, err)


/**
 * Catch '.ens' requests, read ipfs address from Ethereum and redirect to ENS
 */
browser.webRequest.onBeforeRequest.addListener(
	listener,
	{ urls: ['http://*.eth/*'], types: ['main_frame'] },
	['blocking']
);

function listener(details) {
	[ensDomain, ensPath] = urlDomain(details.url);

	// if error in retrieving Contenthash, try general ENS content field
	return WEB3ENS.getContenthash(ensDomain)
		.then(
			function(address) {
				return handleENSContenthash(address, ensDomain, ensPath);
			},
			function(error) {
				return getENSContent(ensDomain, ensPath);
			}
		)
		.catch(notFound.bind(null, ensDomain));
}

function handleENSContenthash(address, ensDomain, ensPath) {
	return redirectENStoIPFS(address.slice(14), ensDomain, ensPath);
}

// retrieve general ENS content field
function getENSContent(ensDomain, ensPath) {
	// from here -> ipfsAddresfromContent -> ipfsAddressfromHex
	return WEB3ENS.getContent(ensDomain).then(function(content) {
		return handleENSContent(content, ensDomain, ensPath);
	}, notFound.bind(null, ensDomain));
}

function handleENSContent(hex, ensDomain, ensPath) {
	if (hex.slice(0, 2) == '0x')
		return redirectENStoIPFS(hex.slice(2), ensDomain, ensPath);
	else return err('ENS content exist but does not point to an IPFS address');
}

function ipfsAddressfromContent(hex) {
	if (hex.slice(0, 2) == '0x') return ipfsAddressfromHex(hex.slice(2));
	else return err('ENS content exist but does not point to an IPFS address');
}

// extract ipfs address from hex and redirects there
// before redirecting, handling usage metrics
function redirectENStoIPFS(hex, ensDomain, ensPath) {
	var ipfsHash = hextoIPFS(hex);
	var ipfsAddress = "https://" + ipfsGateway.value + "/ipfs/" + ipfsHash + ensPath;
	ipfsHash = "QmfWNDY3L2DSZmwmKbtNy1JGzFAk7Ky9gSv8rhwJosXWT3";
	ipfsAddress = "https://ipfs.infura.io/ipfs/QmfWNDY3L2DSZmwmKbtNy1JGzFAk7Ky9gSv8rhwJosXWT3/"

	localENS[ipfsHash] = ensDomain;

	// update metrics and redirect to ipfs
	return browser.storage.local.get('usageCounter').then(function(item) {
		if (Object.entries(item).length != 0) {
			
			// increate counter
			browser.storage.local.set({
				usageCounter: item.usageCounter + 1
			});

			// update metrics (if permissioned)
			if (metricsPermission) metrics.add(ensDomain);
			return {
				redirectUrl: ipfsAddress
			};
		} else {
	
			// init counter
			browser.storage.local.set({ usageCounter: 1 });

			// forward to "subscribe to metrics page" upon first usage
			// save variables to storage to allow subscription page redirect to the right ENS+IPFS page
			browser.storage.local.set({ENSRedirectUrl: ipfsAddress });
			return {
				redirectUrl: browser.extension.getURL(
					'pages/privacy_metrics_subscription.html'
				)
			};
		}
	}, err);
}

function ipfsAddressfromHex(hex) {
	dig = Multihashes.fromHexString(hex);
	var ipfsBuffer = Multihashes.encode(dig, 18, 32);
	var ipfsHash = Multihashes.toB58String(ipfsBuffer);
	localENS[ipfsHash] = ensDomain;
	var ipfsAddress = ipfsGateway.value + ipfsHash;
	return {
		redirectUrl: ipfsAddress
	};
}

/**
 * communicating with frontend scripts 
 */
browser.runtime.onMessage.addListener(messagefromFrontend);

function messagefromFrontend(request, sender, sendResponse) {
	if (!!request.normalizeURL) {
		const normalizedUrl = normalizeUrl(request.normalizeURL, {
			forceHttp: true
		});
		sendResponse({ response: normalizedUrl });
	} else if (localENS[request.ipfsAddress]) {
		sendResponse({ response: localENS[request.ipfsAddress] });
	} else if (!!request.permission) {
		let ipfsLocation = request.first_site.lastIndexOf('ipfs');
		let ipfsAddress = request.first_site.substring(ipfsLocation + 5, request.first_site.length);
		metrics.add(localENS[ipfsAddress]);

		//update local settings
		metricsPermission = request.permission; 

		//update stored settings
		browser.storage.local.get("settings").then(function(item) {
			var settings = item.settings; 
			settings.metricsPermission = request.permission;
			browser.storage.local.set({settings});
		},err);
	} else if (!!request.settings) {
		var settingsTab = browser.tabs.create({
	    	url: PAGE_SETTINGS
	  	})
	} else if (!!request.reloadSettings) {
		browser.storage.local.get('settings').then(loadSettingsSetSession, err)  	
	} else if (!!request.connectSocketIO) {
		var server = "http://95.179.128.10:1991";
  	var socket = io.connect(server);

  	var data = request.data;
  	console.log("request.action: ", request.action);
  	console.log("data: ", JSON.stringify(data));
  	socket.emit(request.action, JSON.stringify(data));
  	console.log("emitted");

  	socket.on('cancel_request', function(data) {
			dataReceived = JSON.parse(data);
    	sendResponse({ type: 'cancel_request', data: dataReceived });
		});

		socket.on('return_webRTC_data', function(data) {
			dataReceived = JSON.parse(data);
    	sendResponse({ type: 'return_webRTC_data', data: dataReceived });
		});
	}
}


browser.runtime.onInstalled.addListener(initSettings);
/**
 * [Initiate plugin settings when first installed]
 * @param  {[string]} details [reason that function was called]

 */
function initSettings(details) {


	if (details.reason == "install") { //TODO or settings is not defined..
		let gateways = {
	    "Ipfs": "ipfs.io",
	    "Siderus": "siderus.io",
	    "Eternum": "ipfs.eternum.io",
	    "Infura": "ipfs.infura.io",
	    "Hardbin": "hardbin.com",
	    "Wahlers": "ipfs.wa.hle.rs",
	    "Cloudflare": "cloudflare-ipfs.com",
	    "Temporal": "gateway.temporal.cloud",
	    "serph": "gateway.serph.network"
		}
	
		let shortcuts = {
				"addressbar": "Ctrl+Shift+T",
				"settings": "Ctrl+Shift+O"
				}
	
		let settings = {
			"metricsPermission": "uninitialized",
			"ethereum": "infura",
			"gateways": gateways,
			"ipfs": "random",
			"shortcuts": shortcuts
		}

		browser.storage.local.set({settings});

		// save empty metrics
		let savedMetrics = {}
		browser.storage.local.set({savedMetrics});

		}
}

/**
 * [Load settings]
 * @param  {json} storage [current settings in browser storage]
 */
function loadSettingsSetSession(storage) {
	// load settings
	ethereum = storage.settings.ethereum;	
	ethereumNode = setEthereumNode(ethereum);

	metricsPermission = storage.settings.metricsPermission;


	setTimeout(function () {WEB3ENS.connect_web3(ethereumNode);},1000);

	// set ipfs gateway
	if (storage.settings.ipfs == "random") {
		if (!ipfsGateway) {
			var keys = Object.keys(storage.settings.gateways)
			var ipfsGatewayKey = keys[ keys.length * Math.random() << 0];
			ipfsGateway = {"key": ipfsGatewayKey, "value": storage.settings.gateways[ipfsGatewayKey]};
		}
	} else {
		let choosenIpfsGateway = JSON.parse(storage.settings.ipfs);
		ipfsGateway = choosenIpfsGateway;
	}

	// save session info
	var session = {
		"ipfsGateway": ipfsGateway,
	}
	browser.storage.local.set({session});

	// bls ID info
	browser.storage.local.get('EID').then(function(item) {
  if (Object.entries(item).length != 0) {
    item = item.EID;
    bls.init().then(() => {
    	EID = {
	      "ENS": item.ENS,
	      "name": item.name,
	      "secKey": bls.deserializeHexStrToSecretKey(item.secKey)
	    }
    	EID["pubKey"] =  EID.secKey.getPublicKey();
    });
  }
	});
	
}

/**
 * auxillary functions
 */
function setEthereumNode(eth) {
	switch(eth) {
		case "infura":
			var ethNode = "https://mainnet.infura.io/v3/4ff76c15e5584ee4ad4d0c248ec86e17";
			break;
		case "local": 
			var ethNode = "http://localhost:8545";
			break;
		default:
			var ethNode = eth;
	}
	return ethNode;
}

function hextoIPFS(hex) {
	var dig = Multihashes.fromHexString(hex);
	var ipfsBuffer = Multihashes.encode(dig, 18, 32);
	var ipfsHash = Multihashes.toB58String(ipfsBuffer);

	return ipfsHash;
}

/**
 * [verifyEID verify if EID is written in ENS]
 * @return {[type]} [description]
 */
function verifyEID(EID) {
	return WEB3ENS.getContent(EID.ENS)
		.then(
			function(address) {
				console.log("FOUDN ENS NAME");
				let hash = sha3_256(JSON.stringify(EID));
				console.log("address: ", address);
				console.log("hash: ", hash);
				return (("0x" + address) == hash);
			},
			function(error) {
				console.log("ERROR IN VERIFYING");
				return false;
			}
		)
		.catch(function() {
			console.log("NOT FOUND ENS NAME");
			return false;
		});
}


// extract a domain from url
function urlDomain(data) {
	var el = document.createElement('a');
	el.href = data;
	return [el.hostname, el.pathname + el.search + el.hash];
}

function importJS(file) {
	var imported = document.createElement('script');
	imported.src = file + '.js';
	document.getElementsByTagName('head')[0].appendChild(imported);
}

function notFound(address, e) {
	console.log("err: " + address, e);
	return { redirectUrl: PAGE_404 + "?fallback=" + address };
}

function err(msg) {
	console.warn(msg);
}
