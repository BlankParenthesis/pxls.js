node-pxls
=========
A node module for interacting with [pxls.space](https://pxls.space/) based websites using a combination of REST API and WebSocket.

Examples
--------
Listening to all pixel placements:
```javascript
const Pxls = require("pxls");

const pxls = new Pxls("pxls.space");
pxls.on("pixel", console.log);
pxls.connect();
```

Save a snapshot of the canvas:
```javascript
const Pxls = require("pxls");

const pxls = new Pxls("pxls.space");
pxls.connect().then(() => {
	pxls.saveCanvas("snapshot.png");
});
```

Getting the online user count:
```javascript
const Pxls = require("pxls");

const pxls = new Pxls("pxls.space");
pxls.connect().then(() => {
	console.log(pxls.users);
});
```