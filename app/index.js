const controllers = ['subscription', 'profile', 'channel', 'bookmark', 'collection', 'video', 'youtube', 'settings'];

const express = require('express'),
    app = express(),
    path = require('path'),
    db = require('./service/database');

db.init();

app.use(express.static('www'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

controllers.forEach(c => {
    const controller = require(`./controllers/${c}.js`);
    app.use(`/${c}`, controller);
})

app.get('/', function (req, res) {
    res.render('home');
});

app.listen(4000, () => {
    console.log('nanotube listening on port 4000...');
});

