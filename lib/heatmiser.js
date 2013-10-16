var net = require('net');

var crc16 = function(buf){
  // Thanks to http://code.google.com/p/heatmiser-wifi/ for the algorithm
  // Process 4 bits of data
  var crc16_4bits = function(crc, nibble){
    var lookup = [0x0000, 0x1021, 0x2042, 0x3063,
                  0x4084, 0x50A5, 0x60C6, 0x70E7,
                  0x8108, 0x9129, 0xA14A, 0xB16B,
                  0xC18C, 0xD1AD, 0xE1CE, 0xF1EF];
    return ((crc << 4) & 0xffff) ^ lookup[(crc >> 12) ^ nibble];
  }

  // Process the whole message
  var crc = 0xffff;
  for(var i=0; i<buf.length; i++){
    crc = crc16_4bits(crc, buf[i] >> 4);
    crc = crc16_4bits(crc, buf[i] & 0x0f);
  }

  // Return the CRC
  return crc;
}



var parse_dcb = function(dcb_buf){
  var model = ['DT', 'DT-E', 'PRT', 'PRT-E', 'PRTHW'][dcb_buf.readUInt8(4)];
  var version = dcb_buf.readUInt8(3);
  var length = dcb_buf.readUInt16LE(0);
  if(length != dcb_buf.length) throw "Incorrect DCB length";
  if(model !== 'PRTHW') version &= 0x7F;
  var program_mode = ['5/2', '7'][dcb_buf.readUInt8(16)];

  return {
    length: length,
    vendor_id: ['HEATMISER', 'OEM'][dcb_buf.readUInt8(2)],
    model: model,
    version: version/10,
    temp_format: ['C', 'F'][dcb_buf.readUInt8(5)],
    switch_differential: dcb_buf.readUInt8(6),
    frost_protection: !!dcb_buf.readUInt8(7),
    calibration_offset: dcb_buf.readUInt16LE(8),
    output_delay: dcb_buf.readUInt8(10),
    up_down_key_limit: dcb_buf.readUInt8(11),
    sensor_selection: ['built_in_only', 'remote_only', 'floor_only', 'built_in+floor', 'remote+floor'][dcb_buf.readUInt8(13)],
    optimum_start: dcb_buf.readUInt8(14),
    rate_of_change: dcb_buf.readUInt8(15),
    program_mode: program_mode,
    frost_protect_temp: dcb_buf.readUInt8(17),
    set_room_temp: dcb_buf.readUInt8(18),
    floor_max_limit: dcb_buf.readUInt8(19),
    floor_max_limit_enabled: !!dcb_buf.readUInt8(20),
    device_on: !!dcb_buf.readUInt8(21),
    key_lock: !!dcb_buf.readUInt8(22),
    run_mode: ['heating', 'frost_protection'][dcb_buf.readUInt8(23)],
    away_mode: ['not_away', 'away'][dcb_buf.readUInt8(24)],
    holiday_enabled: !!dcb_buf.readUInt8(30),
    holiday_return_date: {},
    temp_hold_minutes: dcb_buf.readUInt16LE(31),
    remote_air_temp: dcb_buf.readUInt16LE(33) === 0xFFFF ? null : dcb_buf.readUInt16LE(33)/10,
    floor_temp: dcb_buf.readUInt16LE(35) === 0xFFFF ? null : dcb_buf.readUInt16LE(35)/10,
    built_in_air_temp: dcb_buf.readUInt16LE(37) === 0xFFFF ? null : dcb_buf.readUInt16LE(37)/10,
    error_code: dcb_buf.readUInt8(39),
    heating_on: !!dcb_buf.readUInt8(40),
    boost_in_min: dcb_buf.readUInt16LE(41),
    hot_water_on: !!((model == 'PRTHW') ? dcb_buf.readUInt8(43) : false),
    current_time: extract_date(dcb_buf, model),
  }
}

var extract_date = function(dcb_buf, model){
  var offset = (model == 'PRTHW') ? 3 : 0
  return new Date(2000 + dcb_buf.readUInt8(41 + offset), dcb_buf.readUInt8(42 + offset) -1 , dcb_buf.readUInt8(43 + offset), dcb_buf.readUInt8(45 + offset), dcb_buf.readUInt8(46 + offset), dcb_buf.readUInt8(47 + offset))
}

var parse_response = function(response){
  var code = response.readUInt8(0);
  if(code != 0x94) throw "Invalid return code";
  var frame_len = response.readUInt16LE(1);
  if(frame_len != response.length) throw "Incorrect packet length";
  var crc = response.readUInt16LE(frame_len - 2);
  var calc_crc = crc16(response.slice(0, frame_len - 2));
  if(crc != calc_crc) throw "Incorrect CRC";

  return {
    code: code,
    frame_len: frame_len,
    crc: crc,
    start_addr: response.readUInt16LE(3),
    num_bytes: response.readUInt16LE(5),
    dcb: parse_dcb(response.slice(7, frame_len - 2))
  }
}

var read_device = function(host, port, pin, cb){
  var client = net.connect({host: host, port: port}, function() { //'connect' listener
    var buf = new Buffer([0x93, 0x0B, 0x00, (pin & 0xFF), ((pin & 0xFF00) >> 8), 0x00, 0x00, 0xFF, 0xFF]);
    var crc = crc16(buf)
    buf = Buffer.concat([buf, (new Buffer([(crc & 0xFF), ((crc & 0xFF00) >> 8)]))]);
    client.write(buf);
  });

  client.setTimeout(3000);
  client.on('data', function(data) {
    cb(parse_response(data));
    client.end();
  });
  client.on('timeout', function(e){
    console.log("timed out");
    client.end();
  });
  client.on('error', function(e){
    console.log("error");
    console.log(e);
    client.end();
  });
}

exports.read_device = read_device;

