'use strict'
var http = require('http')
var path = require('path')
var mosca = require('mosca');

var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var argv = require('minimist')(process.argv.slice(2))

var redis = require("redis").createClient('6379', '127.0.0.1');

redis.on("error", function (err) {
    console.log("Error " + err);
});

var moscaSettings = {
    host: '0.0.0.0',
    port: 1883,
};

var http_port = argv.port || 8000;

var mqtt_server = new mosca.Server(moscaSettings);
mqtt_server.attachHttpServer(server)

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.get('/', function (req, res) {
    // res.sendFile(path.join(__dirname, 'index.html'));
    res.render('index', { port: http_port });
});

app.get('/keys', function (req, res) {
    client.keys('session:', function (err, keys) {
        console.log(keys)
    })
});

mqtt_server.on('ready', () => {
    console.log("MQTT server is ready on port %s", moscaSettings.port);
});

mqtt_server.on('clientConnected', (client) => {
    console.log(new Date().toLocaleString(), 'client has connected', client.id);
    redis.set('mqttclient:'+client.id, true, redis.print);
    io.sockets.emit('news', { client: client.id, connect: true });
});

mqtt_server.on('clientDisconnected', function(client){  
    console.log(new Date().toLocaleString(), 'client disconnected', client.id);  
    redis.set('mqttclient:'+client.id, false, redis.print);
    io.sockets.emit('news', { client: client.id, connect: false });
});  

io.sockets.on('connection', function (socket) {
    // socket.emit('news', { hello: 'world' });
    socket.on('mounted', function (data) {
        redis.keys('mqttclient:*', function (err, keys) {
            keys.forEach(function (key, index) {
                redis.get(key, function(err, data){
                    io.sockets.emit('news', { client: key.slice(11), connect: JSON.parse(data) });
                });
            });
        })
    });
    socket.on('remove', function (data) {
        redis.del('mqttclient:'+data.data);
    });
});

server.listen(http_port, function () {
    console.log('Example app listening at http://%s:%s',
    server.address().address,
    server.address().port)
})
