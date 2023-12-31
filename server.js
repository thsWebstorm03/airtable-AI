const express = require("express");
const http = require("http");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const urlencodeParser = bodyParser.urlencoded({ extended: false });
const router = require("./router");

require("dotenv").config({path : app.env});

const port = process.env.PORT || 5001;

app.use(bodyParser.json(), urlencodeParser);
app.use(cors());

app.use((req, res, next) => { //doesn't send response just adjusts it
    res.header("Access-Control-Allow-Origin", "*") //* to give access to any origin
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization" //to give access to all the headers provided
    );
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET'); //to give access to all the methods provided
        return res.status(200).json({});
    }
    next(); //so that other routes can take ove
    
})

app.use("/", router);

app.use((err, req, res, next) => {
    res.locals.error = err;
    if (err.status >= 100 && err.status < 600)
        res.status(err.status);
    else
        res.status(500);
    res.json({
        message: err.message,
        error: err
    });
});

const httpServer = http.createServer(app);

httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});