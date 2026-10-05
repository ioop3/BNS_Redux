// Dependencies
var express = require('express');
var session = require('express-session');
var path = require('path');

// Express app
var app = express();

app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: 'bns'
}));
var project_root = path.resolve(__dirname, '..');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Always serve the canonical game files from the project root. The old static
// directory under server/ only contains a placeholder stylesheet.
app.use(function(req, res, next) {
    res.set('Cache-Control', 'no-store');
    next();
});

app.get('/', function(req, res) {
    res.sendFile(path.join(project_root, 'index.html'));
});

app.use(express.static(project_root));

app.listen(3000, function() {
    console.log('Node app listening on port 3000.');
});

var RESPONSE_CODE_OK = 0;


// Local storage
var sessions = {};

// Debug and API routes

app.get('/debug', function(req, res) {
    res.render('pages/debug', {
        session_id: req.session.id
    });
});

app.get('/init/', function(req, res) {
    var response = {
        "code": RESPONSE_CODE_OK,
        "session_id": req.session.id
    }
    res.send(response);
});

app.get('/add-station/', function(req, res) {
    res.send(req.query.lat);
});
