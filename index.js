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

app.listen(port, () => {
    console.log("Your Assignment 1 is listening on port "+port);
})