node-pxls
=========
A node module for interacting with [pxls.space](https://pxls.space/) based websites using a combination of REST API and WebSocket.

Examples
--------
Listening to all pixel placements:
```javascript
const { Pxls } = require("@blankparenthesis/pxlsspace");

const pxls = new Pxls({ 
	site: "pxls.space", 
	buffers: [],
});
pxls.on("pixel", console.log);
pxls.connect();
```

Save a snapshot of the canvas:
```javascript
const { Pxls, BufferType } = require("@blankparenthesis/pxlsspace");

const pxls = new Pxls({ 
	site: "pxls.space", 
	buffers: [BufferType.CANVAS],
});
pxls.connect().then(() => {
	pxls.saveCanvas("snapshot.png");
});
```

Getting the online user count:
```javascript
const { Pxls } = require("@blankparenthesis/pxlsspace");

const pxls = new Pxls({ 
	site: "pxls.space", 
	buffers: [],
});
pxls.connect().then(() => {
	console.log(pxls.users);
});
```