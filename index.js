var express = require('express');
var redis = require('redis-url').connect(process.env.REDISTOGO_URL);
var Fetcher = require('./lib/fetcher').Fetcher;

var fetcher = new Fetcher(redis, 10000);

var app = express(express.logger());



app.get('/', function(request, response) {
  response.send('Hello World!');
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

