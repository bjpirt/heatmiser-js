var hm   = require('./heatmiser');
var cosm = require('./cosm');

function Fetcher(redis, period){
  var self = this;
  self.devices = {};
  self.redis = redis;
  self.period = period;
  self.start();
}

Fetcher.prototype = {
  start: function(){
    var self = this;
    // Fetch all of the devices and check for new ones
    var refresh_fn = function(){self.refresh()};
    setInterval(refresh_fn, self.period);
    refresh_fn();
  },

  refresh: function(){
    var self = this;
    self.redis.smembers('devices', function(err, device_list){
      if(device_list){
        for(i in device_list){
          if(!self.devices[device_list[i]]){
            self.redis.hgetall('device::' + device_list[i], function(err, stored_device){
              self.devices[device_list[i]] = stored_device;
              setInterval(function(){self.fetch(stored_device)}, self.period);
              self.fetch(stored_device);
            });
          }
        }
      }
    });
  },

  fetch: function(config){
    hm.read_device(config.host, 8068, config.pin, function(result){
      console.log("Updating cosm feed: " + config.feed);
      cosm.update(result, config.feed, config.api_key);
    });
  }

}

exports.Fetcher = Fetcher;
