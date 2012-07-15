# bitreader

Generic, space efficient parser with sugar for digesting strings, ints, etc.

# Install

```bash
$ npm install bitreader
```

# API

## BitReader(*[data]*)
**@returns** `instance`
**@see** `BitReader#write`
***

Instantiate a `BitReader`. Can be used with or without `new`. If `data`
is not passed in, you can call `BitReader#write` to get data into the
parser.

## BitReader#write(*data*)
**@returns** `this`
**@emits** `{'data', data}`
***

Add new data to the internal buffer of the parser. This and
`BitReader#end` allow streams to be piped into the parser.

```js
  var parser = BitReader();
  var f = fs.createReadStream(someLargeFile);
  f.pipe(parser);
  parser.on('data', function(data) {
    // parse things;
  });
```

## BitReader#end(*[data]*)
**@returns** `this`
**@emits** `{'end', data}`
***

