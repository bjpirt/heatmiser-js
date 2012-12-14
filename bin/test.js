#!/usr/bin/env node

var hm = require('../lib/heatmiser');
var cosm = require('../lib/cosm');
var argv = require('optimist').argv;

if(argv['h'] === undefined || argv['p'] === undefined){
  console.log ("Usage: " + argv["$0"] + " -h <host> -p <pin> [-f <cosm feed id> -a <cosm api key>]");
  process.exit();
}

hm.read_device(argv.h, 8068, argv.p, function(result){
  console.log(result)
  if(argv['f'] !== undefined && argv['a'] !== undefined){
    console.log("Updating cosm feed: " + argv.f);
    cosm.update(result, argv.f, argv.a);
  }
});

