const express = require('express');
const app = express();
const port = 3000;

// Serve static files from the current directory
app.use(express.static('./'));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
