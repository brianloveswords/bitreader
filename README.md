# bitreader [![Build Status](https://secure.travis-ci.org/brianloveswords/bitreader.png?branch=master)](http://travis-ci.org/brianloveswords/bitreader)

Generic, space efficient (uses `Buffer#slice` as much as possilbe)
parser with sugar for digesting strings, ints, etc. Inherits from
stream, implements `write` and `end`, and emits `data` events for easy
piping.

## Install

```bash
$ npm install bitreader
```

## Example
Adapted from [streampng](/brianloveswords/streampng)

```js
function SuggestedPalette() { this.intialize.apply(this, arguments) }
SuggestedPalette.prototype.initialize = function initialize(data) {
  var colourSize, chunkSize;
  var parser = BitReader(data);

  this.type = 'sPLT'
  this.paletteName = parser.eatString();
  this.sampleDepth = parser.eatUInt(1);
  this.palette = [];

  colourSize = (this.sampleDepth === 16) ? 2 : 1;
  chunkSize = (colourSize === 2) ? 10 : 6

  this.palette = parser.eatRest({ chunkSize: chunkSize }).map(function (entry) {
    var p = BitReader(entry);
    return {
      red: p.eatUInt(colourSize),
      green: p.eatUInt(colourSize),
      blue: p.eatUInt(colourSize),
      alpha: p.eatUInt(colourSize),
      frequency: p.eatUInt(2)
    }
  }.bind(this));
};
```

## API

See [the API page on the wiki](https://github.com/brianloveswords/bitreader/wiki/API)

## Tests
Uses [tap](/isaacs/node-tap) for testing. Tested against node 0.6.19 and node 0.8.2.

```bash
$ npm test
```

## License

[http://wtfpl.org/](http://wtfpl.org/)
