var express = require('express');
var redis = require('redis-url').connect(process.env.REDISTOGO_URL);
var Fetcher = require('./lib/fetcher').Fetcher;
var User = require('./lib/user').User;

var fetcher = new Fetcher(redis, 10000);

var app = express(express.logger());
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.cookieSession({secret: 'tobereplaced'}));
app.use(express.static(__dirname + '/public'));

app.set('view engine', 'ejs');

app.get('/', function(req, res) {
  if(req.session.userid){
    User.find_with_devices(req.session.userid, function(user){
      //show page of devices if user is logged in
      res.render('home', {user: user});
    });
  }else{
    //otherwise redirect to login
    res.redirect('/login');
  }
});

app.post('/devices', function(req, res){
  if(req.session.userid){
    //make sure the correct fields have been submitted
    if(req.body.host &&
       req.body.pin &&
       req.body.feed &&
       req.body.api_key){
      //look up the user
      User.find(req.session.userid, function(user){
        //add a new device for them
        user.add_device({host: req.body.host, pin: req.body.pin, feed: req.body.feed, api_key: req.body.api_key})
        //redirect to the list of devices
        res.redirect('/');
      });
    }
  }else{
    res.redirect('/login');
  }
});

app.post('/signup', function(req, res){
  //make sure all of the details look valid
  if(req.body.email &&
     req.body.password &&
     req.body.password_confirmation &&
     req.body.password.length >= 6 &&
     req.body.password == req.body.password_confirmation){
    //store the user and log them in
    var user = new User({email: req.body.email, password: req.body.password});
    user.save();
    req.session.userid = req.body.email;
    res.redirect('/');
  }else{
    res.redirect('/signup');
  }
});

app.post('/login', function(req, res){
  //make sure the correct fields have been submitted
  if(req.body.password && req.body.email){
    //compare the password to our stored hash
    User.find(req.body.email, function(user){
      if(user.check_password(req.body.password)){
        req.session.userid = req.body.email;
      }
      res.redirect('/');
    });
  }else{
    res.redirect('/login');
  }
});

app.get('/logout', function(req, res){
  //clear the session
  req.session = null
  res.redirect('/login');
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

