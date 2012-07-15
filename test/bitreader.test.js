var fs = require('fs');
var test = require('tap').test;
var BitReader = require('..');

var data = Buffer('where did you get your _____?');

test('constructor', function (t) {
  var p;
  p = BitReader('lol');
  t.same(p.endianness, 'BE', 'should be BE by default');

  p = BitReader('lol', { endian: 'le' });
  t.same(p.endianness, 'LE', 'should be LE when passed in');

  p = BitReader('lol', { endian: 'little' });
  t.same(p.endianness, 'LE', 'should understand little');

  p = BitReader('lol', { endian: 'big' });
  t.same(p.endianness, 'BE', 'should understand big');
t.end();
});


test('BitReader#eat', function (t) {
  t.test('returns the right values after eating', function (t) {
    var p = new BitReader(data);
    t.same(p.eat(1), Buffer('w'));
    t.same(p.eat(2), Buffer('he'));
    t.same(p.eat(4), Buffer('re d'));
    t.end();
  });

  t.test('reading little endian values', function (t) {
    var buf = Buffer([0xff, 0x00, 0x00, 0x00]);
    var p = BitReader(buf, {endian: 'little'});
    var expect = 0xff;
    var value = p.eat(4, {integer: true});
    t.same(p.endianness, 'LE', 'should be little endian');
    t.same(value, expect, 'should get 255');
    t.end();
  });

  t.test('overriding default endianness', function (t) {
    var buf = Buffer([0xff, 0x00, 0x00, 0x00]);
    var p = BitReader(buf, {endian: 'big'});
    var expect = 0xff;
    var value = p.eat(4, {integer: true, endian: 'little'});
    t.same(p.endianness, 'BE', 'should be big endian');
    t.same(value, expect, 'should get 255');
    t.end();
  });

  t.test('error when trying to read an invalid amount as integer', function (t) {
    var buf = Buffer(12);
    buf.fill(0xff);
    var p = BitReader(buf);
    try {
      p.eat(3, {integer: true});
      t.fail('should not be able to read 3 bytes as an integer');
    } catch (err) {
      t.same(err.name, 'RangeError');
      t.end();
    }
  });

  t.test('error when trying to pass invalid value to endian', function (t) {
    var buf = Buffer(12); buf.fill(0xff);
    try {
      var p = BitReader(buf, {endian: 'huge'});
      t.fail('should not be able to set endian to bogus value');
    } catch (err) {
      t.same(err.name, 'TypeError');
    }

    try {
      var p = BitReader(buf);
      p.eat(4, {integer: true, endian: 'massive'});
      t.fail('should not be able to set endian to bogus value');
    } catch (err) {
      t.same(err.name, 'TypeError');
    }
    t.end();
  });



  t.test('updates the length after eating', function (t) {
    var p = new BitReader(data);
    p.eat(10);
    t.same(p.position(), 10);
    t.end();
  });

  t.test('returns sane values when out of bounds', function (t) {
    var p = new BitReader(data);
    t.same(p.eat(Infinity), data);
    t.same(p.eat(Infinity), null);
    t.end();
  });

  t.test('can cast values to ints', function (t) {
    var p;
    p = new BitReader(Buffer([0x10, 0x80]));
    t.same(p.eat(2, { integer: true }), 4224);

    p = new BitReader(Buffer([0x30, 0x20, 0x10, 0x80]));
    t.same(p.eatInt(4), 807407744);

    p = new BitReader(Buffer([0xf6]));
    t.same(p.eatUInt(1), 246);

    t.end();
  });
  t.end();
});

test('eatInt with endianness', function (t) {
  var buf = Buffer([0xff, 0x00, 0x00, 0x00]);
  var p = BitReader(buf);
  var expect = 0xff;
  var value = p.eatInt(4, 'little');
  t.same(p.endianness, 'BE', 'should be big endian');
  t.same(value, expect, 'should get 255');
  t.end();
});


test('BitReader#eatBool', function (t) {
  t.same(true, (new BitReader(Buffer([0x01])).eatBool()));
  t.same(false, (new BitReader(Buffer([0x00])).eatBool()));
  t.end();
});


test('BitReader#rewind', function (t) {
  var p = new BitReader(data);
  p.eat(9);
  p.rewind(3);
  t.same(p.position(), 6, 'should be 9 - 3');
  t.same(p.eat(3), Buffer('did'), 'eating 3 should return `did`');
  t.end();
});

test('BitReader#peak', function (t) {
  var p = new BitReader(data);
  t.same(p.peaks(), 'w', 'should be the first character');

  p.eat(1024);
  t.same(p.peak(), null, 'should be null');

  p.rewind();
  t.same(p.peak(5), Buffer('where'));
  t.end();
});

test('BitReader#peak with options', function (t) {
  var p = BitReader(Buffer([0xff, 0x00, 0x00, 0x00]));
  var expect = 0xff;
  var value = p.peak(4, {integer: true, endian: 'little'});
  t.same(value, expect, 'should get 255');
  t.end();
});


test('BitReader#eatString', function (t) {
  var data = Buffer('what the who');
  data[4] = 0; data[8] = 0;
  t.test('eats up until it finds a null byte', function (t) {
    var p = new BitReader(data);
    t.same(p.eatString(), 'what');
    t.same(p.eatString(), 'the');
    t.same(p.eatString(), 'who');
    t.end();
  });

  t.test('does not fuck up when it cannot eat', function (t) {
    var p = new BitReader(data);
    p.eat(1024);
    t.same(p.eatString(), null);
    t.end();
  });

  t.test('includes null byte in offset but not string', function (t) {
    var p = new BitReader(data);
    t.same(p.eatString(), 'what');
    t.same(p.eat(3), Buffer('the'));
    t.end();
  });

  test('can specify separator', function (t) {
    var data = Buffer.concat([Buffer('hello'), Buffer([0xff]), Buffer('world')]);
    var p = new BitReader(data);
    t.same(p.eatString(0xff), 'hello');
    t.same(p.eatString(0xff), 'world');
    t.end();
  });

  test('specify invalid separator', function (t) {
    var p = new BitReader('heyhyehyehye');
    try { p.eatString({nope: 'nope'}); t.fail('should throw error') }
    catch (err) { t.same(err.name, 'TypeError') }

    try { p.eatString('nope'); t.fail('should throw error') }
    catch (err) { t.same(err.name, 'TypeError') }

    try { p.eatString('∞'); t.fail('should throw error when given huge char') }
    catch (err) { t.same(err.name, 'RangeError') }

    try { p.eatString(NaN); t.fail('should throw error when given NaN') }
    catch (err) { t.same(err.name, 'TypeError') }

    t.same(p.eatString('y'), 'he')
    t.end();
  });

  t.end();
});

test('BitReader#eatRemaining', function (t) {
  var string = 'how awesome is that?';
  var data = Buffer(string);
  t.test('finish eating the buffer', function (t) {
    var p = new BitReader(data);
    t.same(p.eatRemaining(), Buffer(string));
    t.same(p.eatRemaining(), null);
    p.rewind(5);
    t.same(p.eatRemaining(), Buffer('that?'));
    t.end();
  });

  t.test('digest in chunks', function (t) {
    var p = new BitReader(data);
    var chunks = p.eatRest({ chunkSize: 2 });
    var num = Math.ceil(data.length / 2);
    t.same(chunks.length, num, 'should have right amount of chunks');
    t.same(chunks[0], Buffer('ho'), 'first chunk should match');
    t.end();
  });

  t.test('passing opts to eat', function (t) {
    var data = Buffer([0x00, 0xff, 0x00, 0xff, 0x00, 0xff]);
    var p = new BitReader(data);
    var ints = p.eatRest({ chunkSize: 2, integer: true });
    t.same(ints, [0x00ff, 0x00ff, 0x00ff]);
    t.end();
  });
  t.end();
});

test('BitReader#write', function (t) {
  var string = 'lol';
  var data = Buffer(string);
  var moar = Buffer('lercoaster');

  t.test('appends another buffer to the internal buffer', function (t) {
    var p = new BitReader();
    t.same(p.getBuffer(), Buffer(''));
    t.same(p.write(data).getBuffer(), Buffer('lol'));
    t.same(p.write(moar).getBuffer(), Buffer('lollercoaster'));
    t.end();
  });

  t.end();
});

test('BitReader#remaining', function (t) {
  var data = Buffer('lollerskates');
  var p = new BitReader(data);

  t.same(p.remaining(), data.length);
  p.eat(6);
  t.same(p.remaining(), data.length - 6);
  t.end();
});

test('piping data in, simple', function (t) {
  var p = BitReader();
  var expect = fs.readFileSync(__dirname + '/testfile.txt');
  var f = fs.createReadStream(__dirname + '/testfile.txt', {bufferSize: 2});
  function errHandler() { t.fail('should not have an error') }
  f.pipe(p);
  f.on('error', errHandler); p.on('error', errHandler);

  t.plan(8);
  p.on('data', function (d) { t.pass('got event') });
  p.on('end', function () {
    t.same(expect, this.getBuffer());
    t.end();
  });
});

test('piping data in, double pipe', function (t) {
  var p = BitReader();
  var p2 = BitReader();
  var expect = fs.readFileSync(__dirname + '/testfile.txt');
  var f = fs.createReadStream(__dirname + '/testfile.txt', {bufferSize: 2});
  function errHandler() { t.fail('should not have an error') }
  f.pipe(p).pipe(p2);
  f.on('error', errHandler); p.on('error', errHandler);
  p2.on('end', function () {
    t.same(expect, this.getBuffer());
    t.end();
  });
});
