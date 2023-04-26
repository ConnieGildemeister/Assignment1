require('dotenv').config();
const express = require('express');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const saltrounds = 12;

const session = require('express-session');


const app = express();

const expireTime = 1 * 60 * 60 * 1000;

const port = process.env.PORT || 4000;

const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

app
app.use(session({
    secret: node_session_secret,
    saveUninitialized: false,
    resave: true 
}))

var users = [];

const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;

app.use(express.urlencoded({extended: false}));

var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@cluster0.3ccoipv.mongodb.net/test`,
	crypto: {
		secret: mongodb_session_secret
	}

})

app.use(session({ 
    secret: node_session_secret,
	store: mongoStore, //default is memory store 
	saveUninitialized: false, 
	resave: true
}
));

app.get('/', (req,res) => {
    if (req.session.numViews == null) {
        req.session.numViews = 0;
    } else {
        req.session.numViews++;
    }
    res.send('The page has ' + req.session.numViews + ' views');
})

app.get('/createUser', (req,res) => {
    var html = `
    create user
    <form action='/submitUser' method='post'>
    <input name='username' type='text' placeholder='username'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.get('/login', (req,res) => {
    var html = `
    log in
    <form action='/loggingin' method='post'>
    <input name='username' type='text' placeholder='username'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});


app.post('/submitUser', (req,res) => {
    var username = req.body.username;
    var password = req.body.password;

    var hashedPass = bcrypt.hashSync(password, saltrounds);

    users.push({ username: username, password: hashedPass });

    console.log(users);

    var usersPerson = "";
    for (i = 0; i < users.length; i++) {
        usersPerson += users[i].username + ": " + users[i].password + "</br>";
    }

    var html = usersPerson + "</br>";
    res.send(html);
});

app.post('/loggingin', (req,res) => {
    var username = req.body.username;
    var password = req.body.password;


    var usershtml = "";
    for (i = 0; i < users.length; i++) {
        if (users[i].username == username) {
            if (bcrypt.compareSync(password, users[i].password)) {
                req.session.authenticated = true;
                req.session.username = username;
                req.session.cookie.maxAge = expireTime;
                res.redirect('/loggedIn');
                return;
            }
        }
    }

    //user and password combination not found
    res.redirect("/login");
});

app.get('/loggedin', (req,res) => {
    if (!req.session.authenticated) {
        res.redirect('/login');
    }
    var html = `
    successfully logged in!
    `;
    res.send(html);
});

app.get('/contact', (req,res) => {
    var missingEmail = req.query.missing;
    var html = `
        email address:
        <form action='/submitEmail' method='post'>
            <input name='email' type='text' placeholder='email'>
            <button>Submit</button>
        </form>
    `;
    if (missingEmail) {
        html += "<br> email is required";
    }
    res.send(html);
});

app.post('/email', (req,res) => {
    var email = req.body.email;
    if (!email) {
        res.redirect('/contact?missing=1');
    }
    else {
        res.send("The email you input is: "+email);
    }
});

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
