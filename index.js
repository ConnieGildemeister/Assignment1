const express = require('express');

const session = require('express-session');


const app = express();

const port = process.env.PORT || 4000;

const node_session_secret = '2db5ddae-906e-4903-85c5-d86dffce3a06';

app
app.use(session({
    secret: node_session_secret,
    saveUninitialized: false,
    resave: true 
}))

var numViews = 0;

app.get('/', (req,res) => {
    if (req.session.numViews == null) {
        req.session.numViews = 0;
    } else {
        req.session.numViews++;
    }
    res.send('The page has ' + req.session.numViews + ' views');
})


app.get('/RE/:id', (req,res) => {

    var RE = req.params.id;

    if (RE == 1) {
        res.send("RE1: <img src='/RE1.jpg' style='width:250px;'>");
    }
    else if (RE == 2) {
        res.send("RE2: <img src='/RE2.png' style='width:250px;'>");
    }
    else {
        res.send("Invalid Resident evil game id: "+RE);
    }
});

app.use(express.static(__dirname + "/public"));

app.get("*", (req,res) => {
	res.status(404);
	res.send("404 error - page not found");
});

app.listen(port, () => {
    console.log("Your Assignment 1 is listening on port "+port);
})
