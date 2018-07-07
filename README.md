node-pxls
=========
A node module for interacting with [pxls.space](https://pxls.space/) based websites using a combination of REST API and WebSocket.

Examples
--------
Listening to all pixel placements:
```javascript
const pxls = require("pxls");

const pxls = new Pxls("pxls.space");
pxls.on("pixel", console.log);
pxls.connect();
```
Looking up pixels:
```javascript
const Pxls = require("pxls");

const pxls = new Pxls("pxls.space");
pxls.connect().then(() => {
	console.log(await pxls.lookup(10, 40));

	// wait for rate-limiting if needed
	console.log(await pxls.eventuallyLookup(10, 40));
});
```
Save a snapshot of the canvas:
```javascript
const Pxls = require("pxls");

const pxls = new Pxls("pxls.space");
pxls.connect().then(() => {
	pxls.save("snapshot.png");
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