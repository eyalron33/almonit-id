let prevSelectedCurve = -1

browser.storage.local.get('EID').then(function(item) {
	if (Object.entries(item).length != 0) {
		item = item.EID; 
		var EID = {
			"ENS": item.ENS,
			"name": item.name,
			"pubKey": item.pubKey
		}
		setEIDPanel(item.ENS, item.name, item.secKey, item.pubKey, sha3_256(JSON.stringify(EID)));
	}
});

function generateEID() {
	bls.init().then(() => {
		var sec = new bls.SecretKey();
		sec.setByCSPRNG();
		var pub = sec.getPublicKey();

		saveEID(document.getElementById("ENSInput").value, document.getElementById("NameInput").value, sec.serializeToHexStr(), pub.serializeToHexStr())

		}, err)
}

function recoverEID() {
	bls.init().then(() => {
		var secKeyRecover = document.getElementById("secKeyRecover").value;
		var sec = bls.deserializeHexStrToSecretKey(secKeyRecover);
		var pub = sec.getPublicKey();

		saveEID(document.getElementById("ENSRecover").value, document.getElementById("nameRecover").value, sec.serializeToHexStr(), pub.serializeToHexStr());
	}, err)
}

function saveEID(ENS, name, secKey, pubKey) {
	// first: to create hash
	var EID = {
		"ENS": ENS,
		"name": name,
		"pubKey": pubKey
	}
	setEIDPanel(ENS, name, secKey, pubKey, sha3_256(JSON.stringify(EID)));

		// second: to save in file
		var EID = {
			"ENS": ENS,
			"name": name,
			"secKey": secKey
		}
		// generate save EID to file link
		generateEIDtoSave(JSON.stringify(EID), "EID.txt", 'text/plain');

		// third: to save in browser storage
		EID = {
			"ENS": ENS,
			"name": name,
			"secKey": secKey,
			"pubKey": pubKey
		}

		browser.storage.local.set({EID});
}

function LoadEID() {
	var file = this.files[0];

	var reader = new FileReader();
  reader.readAsText(file);
  reader.onload = () => {
  	let loadedEID = JSON.parse(reader.result);
    bls.init().then(() => {
		var sec = bls.deserializeHexStrToSecretKey(loadedEID.secKey);
		var pub = sec.getPublicKey();

		saveEID(loadedEID.ENS, loadedEID.name, sec.serializeToHexStr(), pub.serializeToHexStr());
	}, err)
  };
}

function setEIDPanel(ENS, name, secKey, pubKey, hash) {
	document.getElementById("ENSName").textContent = "ENS: " + ENS;
	document.getElementById("Name").textContent = "Name: " + name;
	document.getElementById("secKey").textContent = "Secret key: " + secKey;
	document.getElementById("pubKey").textContent = "Public key: " + pubKey;	
	document.getElementById("hash").innerHTML = "Hash (put in your ENS name): " + hash;
}

function generateEIDtoSave(text, name, type) {
  var a = document.getElementById("saveEID");
  var file = new Blob([text], {type: type});
  a.href = URL.createObjectURL(file);
  a.download = name;
}

function err(msg) {
  console.warn(msg);
}
