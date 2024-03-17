require("./utils.js");
const mysql = require("mysql2/promise")

require('dotenv').config();
const express = require('express');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const saltRounds = 12;


const session = require('express-session');

const app = express();

const Joi = require("joi");

const port = process.env.PORT || 3000;

const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

const expireTime = 1 * 60 * 60 * 1000;

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;

var {database} = include('databaseConnection');


app.use(express.urlencoded({extended: false}));

var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/test`,
	crypto: {
		secret: mongodb_session_secret
	}

})

app.use(session({ 
    secret: node_session_secret,
	store: mongoStore,
	saveUninitialized: false, 
	resave: true
}
));

const isAuthenticated = (req, res, next) => {
    if (req.session.authenticated) {
        return res.redirect('/loggedin');
    }
    return next();
};

const sqldb = process.env.SQL_DATABASE;
const sqluser = process.env.SQL_USER;
const sqlpassword = process.env.SQL_PASSWORD;
const sqlhost = process.env.SQL_HOST;

const sqlConfig = {
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    multipleStatements: true
};

async function connectAndQuery() {
    try {
        // Create a connection to the database
        const connection = await mysql.createConnection({
            host: sqlhost, // MySQL server host
            user: sqluser, // MySQL username
            password: sqlpassword, // MySQL password
            database: sqldb, // MySQL database name
            multipleStatements: true // Allow multiple SQL statements per query
        });

        // Perform a query
        const [rows, fields] = await connection.execute('SELECT * FROM user');

        // Log query results
        console.log(rows);

        // Close the connection
        await connection.end();
    } catch (error) {
        console.error('Error connecting to the database:', error);
    }
}


const userCollection = database.db(sqldb).collection('user');

// Call the function
connectAndQuery();

app.get('/', isAuthenticated, (req,res) => {

    var html = `
    <h2><a href="/createUser">Sign Up</a></br>
    <a href="/login">Log In</a><h2>
    `

    res.send(html);
});

app.get('/nosql-injection', async (req,res) => {
	var username = req.query.user;

	if (!username) {
		res.send(`<h3>no user provided - try /nosql-injection?user=name</h3> <h3>or /nosql-injection?user[$ne]=name</h3>`);
		return;
	}
	console.log("user: "+username);

	const schema = Joi.string().required();
	const validationResult = schema.validate(username);

	if (validationResult.error != null) {  
	   console.log(validationResult.error);
	   res.send("<h1 style='color:darkred;'>A NoSQL injection attack was detected!!</h1>");
	   return;
	}	

	const result = await userCollection.find({username: username}).project({username: 1, password: 1, user_id: 1}).toArray();

	console.log(result);

    res.send(`<h1>Hello ${username}</h1>`);
});

app.get('/createUser', (req,res) => {
    const errorMessage = req.query.error ? decodeURIComponent(req.query.error) : '';
    
    let errorHtml = '';
    if (errorMessage) {
        errorHtml = `<p style="color:red;">${errorMessage}</p>`;
    }
    var html = `
    <h2>Create user</h2>
    ${errorHtml}
    <form action='/submitUser' method='post'>
    <input name='username' type='text' placeholder='username'></br>
    <input name='password' type='password' placeholder='password'></br>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.get('/login', (req,res) => {

    var html = `
    <h2>Log in</h2>
    <form action='/loggingin' method='post'>
    <input name='username' type='text' placeholder='username'></br>
    <input name='password' type='password' placeholder='password'></br>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.get('/loginErrorUser', (req,res) => {
    var html = `
    <h2>Log in</h2>
    <form action='/loggingin' method='post'>
    <input name='username' type='text' placeholder='username'></br>
    <input name='password' type='password' placeholder='password'></br>
    <button>Submit</button>
    </form>
    <h3 style='color:darkred;'>User not found</h3>
    `;
    res.send(html);
});

app.get('/loginErrorPassword', (req,res) => {
    var html = `
    <h2>Log in</h2>
    <form action='/loggingin' method='post'>
    <input name='username' type='text' placeholder='username'></br>
    <input name='password' type='password' placeholder='password'></br>
    <button>Submit</button>
    </form>
    <h3 style='color:darkred;'>Incorrect Password</h3>
    `;
    res.send(html);
});


app.post('/submitUser', async (req, res) => {
    const { username, password } = req.body;

    const passwordComplexityOptions = {
        min: 10,
        max: 30,
        lowerCase: 1,
        upperCase: 1,
        numeric: 1,
        symbol: 1,
        requirementCount: 4,
    };

    // Validation schema for user input
    const schema = Joi.object({
        username: Joi.string().alphanum().required(),
        password: Joi.string().min(passwordComplexityOptions.min).max(passwordComplexityOptions.max).pattern(new RegExp('(?=.*[a-z])')).pattern(new RegExp('(?=.*[A-Z])')).pattern(new RegExp('(?=.*[0-9])')).pattern(new RegExp('(?=.*[!@#$%^&*(),.?":{}|<>])')).message('Password must be stronger.').required()
    });

    const validationResult = schema.validate({ username, password });
    if (validationResult.error) {
        console.log(validationResult.error);
        const errorMsg = encodeURIComponent(validationResult.error.details[0].message);
        return res.redirect(`/createUser?error=${errorMsg}`);
    }

    try {
        // Hash the user's password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Connect to the MySQL database
        const connection = await mysql.createConnection(sqlConfig);

        // Insert the new user into the database using a parameterized query
        const insertQuery = "INSERT INTO user (username, password_hash) VALUES (?, ?)";
        const [rows] = await connection.execute(insertQuery, [username, hashedPassword]);

        console.log("Inserted user:", rows);
        await connection.end();

        // Set session variables and redirect the user
        req.session.authenticated = true;
        req.session.username = username;
        req.session.cookie.maxAge = expireTime;
        res.redirect('/loggedin');
    } catch (error) {
        console.error('Error inserting user into MySQL database:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/loggingin', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    const schema = Joi.string().required();
    const validationResult = schema.validate(username);
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.redirect("/login");
        return;
    }

    try {
        const connection = await mysql.createConnection(sqlConfig);
        
        const safeQuery = 'SELECT * FROM user WHERE username = ?';
        console.log("safeQuery: ", safeQuery);
        const [users] = await connection.execute(safeQuery, [username]);

        await connection.end();

        if (users.length === 0) {
            console.log("user not found");
            res.redirect("/loginErrorUser");
            return;
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (passwordMatch) {
            console.log("correct password");
            req.session.authenticated = true;
            req.session.username = username;
            req.session.cookie.maxAge = expireTime;
            res.redirect('/loggedin');
        } else {
            console.log("incorrect password");
            res.redirect("/loginErrorPassword");
        }
    } catch (error) {
        console.error('Error checking user in MySQL database:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/loggedin', async (req, res) => {
    if (!req.session.authenticated) {
        return res.redirect('/login');
    }

    const username = req.session.username;

    try {
        const connection = await mysql.createConnection(sqlConfig);
        const [userRows] = await connection.execute('SELECT user_id FROM user WHERE username = ?', [username]);
        const userId = userRows[0].user_id;
        let roomsWithUnreadCounts = [];

        // Fetch the list of room IDs the user is part of
        const [rooms] = await connection.execute(`
            SELECT ru.room_id, r.name
            FROM room_user ru
            JOIN room r ON ru.room_id = r.room_id
            WHERE ru.user_id = ?`,
            [userId]
        );

        for (const room of rooms) {
            try {
                const roomId = room.room_id;
        
                const [unreadCountResult] = await connection.execute(`
                    SELECT COUNT(*) AS unread_count
                    FROM message
                    JOIN room_user ON room_user.room_user_id = message.room_user_id
                    WHERE message_id > (
                        SELECT last_read
                        FROM room_user
                        WHERE room_user.room_id = ?
                        AND room_user.user_id = ?
                    )
                    AND room_id = ?
                    `,
                    [roomId, userId, roomId]
                );
                const unreadCount = unreadCountResult[0].unread_count;

                const [latestMessage] = await connection.execute(`
                    SELECT MAX(sent_datetime) AS latestMessageDate
                    FROM message
                    JOIN room_user ON message.room_user_id = room_user.room_user_id
                    WHERE room_user.room_id = ?
                    `,
                    [roomId]
                );
                const latestMessageDate = latestMessage[0].latestMessageDate;
        
                roomsWithUnreadCounts.push({
                    room_id: roomId,
                    name: room.name,
                    unread_count: unreadCount,
                    latestMessageDate: latestMessageDate
                });
        
                console.log(`Room ID ${roomId} has ${unreadCount} unread messages.`);
            } catch (error) {
                console.error(`Error executing query for room ID ${roomId}:`, error);
            }
        }

        let roomsHtml = roomsWithUnreadCounts.map(room => `
            <li>
                <a href="/rooms/${room.room_id}">${room.name}</a> ${room.unread_count} Unread </br>
                Last sent: ${room.latestMessageDate}
            </li></br>
        `).join('');

        roomsHtml = `<ul>${roomsHtml}</ul>`;

        const html = `
            <h2>Successfully logged in as ${username}!</h2>
            <h3>Your Rooms:</h3>
            ${roomsHtml}
            <h3><a href="/createRoom">Create a Room</a></h3>
            <h2><a href="/logout">Log Out</a></h2>
        `;

        res.send(html);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('An error occurred while fetching your rooms.');
    }
});


app.get('/rooms/:roomId', async (req, res) => {
    if (!req.session.authenticated) {
        return res.redirect('/login');
    }
    const { roomId } = req.params;

    try {
        const connection = await mysql.createConnection(sqlConfig);
        const [rows] = await connection.execute('SELECT user_id FROM user WHERE username = ?', [req.session.username]);
        const userId = rows[0].user_id;
        const [rooms] = await connection.execute('SELECT name FROM room WHERE room.room_id = ?', [roomId]);
        
        const [roomCheck] = await connection.execute(
            'SELECT 1 FROM room_user WHERE room_id = ? AND user_id = ?',
            [roomId, userId]
        );

        if (roomCheck.length === 0) {
            return res.status(403).send('Access Denied: You are not a member of this room.');
        }


        if (rooms.length === 0) {
            return res.status(404).send('Room not found.');
        }
        

        const roomName = rooms[0].name;
        
        const [latestMessage] = await connection.execute(`
            SELECT MAX(message.message_id) AS latestMessageId
            FROM message
            INNER JOIN room_user ON message.room_user_id = room_user.room_user_id
            WHERE room_user.room_id = ?
            `,
            [roomId]
          );
        const latestMessageId = latestMessage[0].latestMessageId;

        const [lastRead] = await connection.execute('SELECT room_user.last_read FROM room_user WHERE room_user.room_id = ? AND room_user.user_id = ?', [roomId, userId])
        const lastReadMessageId = lastRead[0].last_read;

        const [readMessages] = await connection.execute(`
            SELECT message.message_id, message.text, user.username, message.sent_datetime, GROUP_CONCAT(DISTINCT e.image ORDER BY e.emoji_id) as emojis
            FROM message
            INNER JOIN room_user ON message.room_user_id = room_user.room_user_id
            INNER JOIN user ON room_user.user_id = user.user_id
            LEFT JOIN message_emoji me ON message.message_id = me.frn_message_id
            LEFT JOIN emoji e ON me.frn_emoji_id = e.emoji_id
            WHERE message.message_id <= ?
            AND room_user.room_id = ?
            GROUP BY message.message_id
            ORDER BY message.sent_datetime ASC;
        `, [lastReadMessageId, roomId]);

        const [unreadMessages] = await connection.execute(`
            SELECT message.message_id, message.text, user.username, message.sent_datetime, GROUP_CONCAT(DISTINCT e.image ORDER BY e.emoji_id) as emojis
            FROM message
            INNER JOIN room_user ON message.room_user_id = room_user.room_user_id
            INNER JOIN user ON room_user.user_id = user.user_id
            LEFT JOIN message_emoji me ON message.message_id = me.frn_message_id
            LEFT JOIN emoji e ON me.frn_emoji_id = e.emoji_id
            WHERE message.message_id > ?
            AND room_user.room_id = ?
            GROUP BY message.message_id
            ORDER BY message.sent_datetime ASC;
        `, [lastReadMessageId, roomId]);
        
        if (latestMessageId) {
            await connection.execute(
              'UPDATE room_user SET last_read = ? WHERE room_user.room_id = ? AND room_user.user_id = ?',
              [latestMessageId, roomId, userId]
            );
        }

        console.log("readMessages: ", readMessages);
        console.log("unreadMessages: ", unreadMessages);

        const emojis = ['👍', '❤️', '😂', '😮', '😢', '👏'];

        let messagesHtml1 = readMessages.map(message => {
            // Create a dropdown or buttons for emoji reactions
            let emojiForm = '<form class="emoji-form" action="/react" method="post">';
            emojiForm += `<input type="hidden" name="messageId" value="${message.message_id}">`;
            emojiForm += `<input type="hidden" name="roomId" value="${roomId}">`;
            emojiForm += `<select name="emoji" onchange="this.form.submit()">`;
            emojiForm += `<option value="">React...</option>`;
            emojis.forEach(emoji => {
                emojiForm += `<option value="${emoji}">${emoji}</option>`;
            });
            emojiForm += `</select>`;
            emojiForm += `</form>`;

            // Construct the list item for the message
            return `<li>
                ${message.username}: ${message.text}</br>
                ${message.emojis}</br>
                Sent at ${message.sent_datetime}
                ${emojiForm}
            </li>`;
        }).join('');
        messagesHtml1 = `<ul>${messagesHtml1}</ul>`;
        
        let messagesHtml2 = unreadMessages.map(message => {
            // Create a dropdown or buttons for emoji reactions
            let emojiForm = '<form class="emoji-form" action="/react" method="post">';
            emojiForm += `<input type="hidden" name="messageId" value="${message.message_id}">`;
            emojiForm += `<input type="hidden" name="roomId" value="${roomId}">`;
            emojiForm += `<select name="emoji" onchange="this.form.submit()">`;
            emojiForm += `<option value="">React...</option>`;
            emojis.forEach(emoji => {
                emojiForm += `<option value="${emoji}">${emoji}</option>`;
            });
            emojiForm += `</select>`;
            emojiForm += `</form>`;

            // Construct the list item for the message
            return `<li>
                ${message.username}: ${message.text}</br>
                ${message.emojis}</br>
                Sent at ${message.sent_datetime}
                ${emojiForm}
            </li>`;
        }).join('');
        messagesHtml2 = `<ul>${messagesHtml2}</ul>`;
        
        let messagesHtml;

        if (unreadMessages.length === 0) {
            messagesHtml = `${messagesHtml1}`;
        } else {
            messagesHtml = `${messagesHtml1}
            <hr style="border-top: 2px solid red;"> 
            <h3>Unread Messages:</h3>
            ${messagesHtml2}`;
        }

        const html = `
            <nav><a href="/loggedin">Home</a> / <a href="/rooms/${roomId}">${roomName}</a></nav>
            <h2>User: ${req.session.username}</h2>
            <h2>${roomName}</h2>
            <h3>Invite a friend:</h3>
            <form action="/inviteFriend" method="post">
                <input name="username" type="text" placeholder="Friend's username" required>
                <input name="roomId" type="hidden" value="${roomId}">
                <button>Invite</button>
            </form>
            <h3>Messages:</h3>
            ${messagesHtml}
            <h3>Send a Message:</h3>
            <form action="/rooms/${roomId}/sendMessage" method="post">
                <input name="message" type="text" placeholder="Your message" required>
                <button>Send</button>
            </form>
            <p><a href="/loggedin">Back to Rooms</a></p>
        `;

        res.send(html);
    } catch (error) {
        console.error('Error fetching room details:', error);
        res.status(500).send('Failed to load room details.');
    }
});

app.post('/react', async (req, res) => {
    if (!req.session.authenticated) {
        return res.redirect('/login');
    }

    const { messageId, emoji, roomId } = req.body;
    console.log("messageId: ", messageId);
    console.log("emoji: ", emoji);
    console.log("roomId: ", roomId);

    try {
        const connection = await mysql.createConnection(sqlConfig);
        const [rows] = await connection.execute('SELECT user_id FROM user WHERE username = ?', [req.session.username]);
        const userId = rows[0].user_id;

        await connection.execute(`
            INSERT INTO message_emoji (frn_message_id, frn_emoji_id, frn_user_id)
            VALUES (?, (SELECT emoji_id FROM emoji WHERE name = ?), ?)
        `, [messageId, emoji, userId]);

        res.redirect(`/rooms/${roomId}`);
    } catch (error) {
        console.error('Error submitting emoji reaction:', error);
        res.status(500).send('There was an error submitting your reaction.');
    }
});


app.post('/inviteFriend', async (req, res) => {

    if (!req.session.authenticated) {
        return res.redirect('/login');
    }

    const { username } = req.body;
    const { roomId } = req.body;

    if (!username) {
        return res.send('Please provide a username.');
    }

    try {
        const connection = await mysql.createConnection(sqlConfig);

        const [users] = await connection.execute('SELECT user.user_id FROM user WHERE user.username = ?', [username]);

        if (users.length === 0) {
            return res.send('User not found.');
        }

        const [roomUsers] = await connection.execute('SELECT room_user.user_id FROM room_user WHERE room_user.room_id = ? AND room_user.user_id = ?', [roomId, users[0].user_id]);
        
        if (roomUsers.length > 0) {
            return res.send('User is already in the room.');
        }

        const query = 'INSERT INTO room_user (room_user.room_id, room_user.user_id) VALUES (?, ?)';
        await connection.execute(query, [roomId, users[0].user_id]);

        await connection.end();

        res.redirect(`/rooms/${roomId}`);

    } catch (error) {
        console.error('Error inviting friend:', error);
        res.status(500).send('Failed to invite friend.');
    }
});

app.post('/rooms/:roomId/sendMessage', async (req, res) => {

    if (!req.session.authenticated) {
        return res.redirect('/login');
    }

    const { roomId } = req.params;
    const { message } = req.body;

    if (!message) {
        return res.send('Please provide a message.');
    }

    try {
        const connection = await mysql.createConnection(sqlConfig);
        
        const query = 'INSERT INTO message (text, room_user_id) VALUES (?, (SELECT room_user_id FROM room_user WHERE room_id = ? AND user_id = (SELECT user_id FROM user WHERE username = ?)))';
        await connection.execute(query, [message, roomId, req.session.username]);
        
        await connection.end();

        res.redirect(`/rooms/${roomId}`);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send('Failed to send message.');
    }
});

app.get('/createRoom', (req, res) => {
    if (!req.session.authenticated) {
      return res.redirect('/login');
    }
  
    const html = `
    <h2>User: ${req.session.username}</h2>
      <h2>Create a Room</h2>
      <form action="/submitRoom" method="post">
        <input name="roomName" type="text" placeholder="Room Name" required>
        <button>Create Room</button>
      </form>
    `;
  
    res.send(html);
});

app.post('/submitRoom', async (req, res) => {
    if (!req.session.authenticated) {
        // Redirect users who are not logged in
        return res.redirect('/login');
    }

    const { roomName } = req.body;
    if (!roomName) {
        // Handle the case where the room name is not provided
        return res.send('Please provide a room name.');
    }

    try {
        const connection = await mysql.createConnection(sqlConfig);
        const query = 'INSERT INTO room (name) VALUES (?)';
        await connection.execute(query, [roomName]);
        const query2 = 'INSERT INTO room_user (room_id, user_id) VALUES (LAST_INSERT_ID(), (SELECT user_id FROM user WHERE username = ?))';
        await connection.execute(query2, [req.session.username]);

        // Optionally, close the connection if you're not using connection pooling
        await connection.end();

        // Redirect or inform the user of success
        res.send(`
            <h2>User: ${req.session.username}</h2>
            <p>Room created successfully!</p>
            <p><a href="/loggedin">Return to Dashboard</a></p>
        `);
        

    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).send('Failed to create room.');
    }
});

app.get('/logout', (req,res) => {
	req.session.destroy();
    res.redirect('/');
});

app.use(express.static(__dirname + "/public"));

app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

app.use((err, req, res, next) => {
    const status = err.status || 500;

    res.status(status).send(`Error ${status}: ${err.message}`);
});

app.listen(port, () => {
    console.log("Your Assignment 2 is listening on port "+port);
})
