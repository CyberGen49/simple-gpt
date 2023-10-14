// Development server
// Just serve the current directory on port 8080
const express = require('express');
const app = express();
app.use(express.static('.'));
app.listen(8080, () => console.log('Listening on port 8080'));