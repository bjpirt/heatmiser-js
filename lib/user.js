var redis = require('redis-url').connect(process.env.REDISTOGO_URL);
var bcrypt = require('bcrypt');
var crypto = require('crypto');

var User = function(attributes){
  var self = this;
  self.email = attributes.email;
  if(attributes.pass_hash){
    self.pass_hash = attributes.pass_hash;
  }else if(attributes.password){
    self.pass_hash = bcrypt.hashSync(attributes.password, bcrypt.genSaltSync(10));
  }
  if(typeof(attributes.device_ids) === 'string'){
    self.device_ids = JSON.parse(attributes.device_ids);
  }else{
    self.device_ids = attributes.device_ids || [];
  }
  return self;
}

User.prototype = {
  check_password: function(password, cb){
    return bcrypt.compareSync(password, this.pass_hash)
  },
  save: function(){
    var self = this;
    redis.hmset('user::' + self.email, {email: self.email, pass_hash: self.pass_hash, device_ids: JSON.stringify(self.device_ids)})
  },
  add_device: function(attributes){
    var self = this;
    var current_date = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    var device_id = crypto.createHash('sha1').update(current_date + random).digest('hex').slice(0, 16);
    //store the details for the device
    attributes.id = device_id;
    attributes.user_id = self.email;
    redis.hmset('device::' + device_id, attributes);
    //store a pointer to the device in the user object
    self.device_ids.push(device_id);
    self.save();
    //store a pointer to the device in the device list
    redis.sadd('devices', device_id);
  },
  delete_device: function(device_id){
    var self = this;
    self.device_ids = self.device_ids.filter(function(x){ return x != device_id });
    self.save();
    redis.srem('devices', device_id);
    redis.del('device::' + device_id);
  }
}

User.find = function(email, cb){
  redis.hgetall('user::' + email, function(err, res){
    if(res){
      cb(new User(res));
    }else{
      raise("User not found");
    }
  });
}

User.find_with_devices = function(email, cb){
  User.find(email, function(user){
    multi = redis.multi();
    for(var i=0; i< user.device_ids.length; i++){
      multi.hgetall('device::' + user.device_ids[i]);
    }
    multi.exec(function(err, replies){
      user.devices = {}
      for(var i=0; i< replies.length; i++){
        user.devices[replies[i].id] = replies[i];
      }
      cb(user);
    });
  });
}

exports.User = User
