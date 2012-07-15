var Stream = require('stream').Stream;
var util = require('util');
/**
  A generic parser, implementing generic parser things like eating
  bytes, rewinding, peaking, etc.
*/

function BitReader(data, opts) {
  if (!(this instanceof BitReader))
    return new BitReader(data, opts);
  opts = opts || {};
  this._buffer = new Buffer(0);
  if (data) this.write(data);
  this.writable = true;
  this.setEndian(opts.endian || 'BE');
  this._offset = 0;
}
util.inherits(BitReader, Stream);
BitReader.interpretEndian = function interpretEndian(str) {
  if (str.match(/^(le|little)$/i)) return 'LE'
  if (str.match(/^(be|big)$/i)) return 'BE';
  return null;
};

BitReader.prototype.setEndian = function setEndian(end) {
  var endianness;
  if ((endianness = BitReader.interpretEndian(end))) {
    this.endianness = endianness;
    return this;
  }
  var err = new TypeError(util.format('Unrecognized input: %s. Acceptable inputs are: [LE, little, BE, big]', end));
  throw err;
};

/**
 * Append a new buffer. If given a string, will perform conversion to buffer.
 *
 * @param {Buffer|String} data buffer (or string) to append
 * @return {Buffer} reference to new buffer.
 */
BitReader.prototype.write = function (data) {
  var newbuf = Buffer.isBuffer(data) ? data : Buffer(data.toString());
  var oldbuf = this._buffer;
  var length = newbuf.length + oldbuf.length;
  this._buffer = Buffer.concat([oldbuf, newbuf], length)
  this.emit('data', data);
  return this;
};

BitReader.prototype.end = function (data) {
  if (data) this.write(data);
  this.emit('end', data);
  return this;
};


/**
 * Create new view of the internal buffer starting from the stored offset
 * and ending at offset + `amount`.
 *
 * @param {Integer} amount how many bytes to consume [default: 1]
 * @return {Buffer} with `amount` bytes or `null`.
 */

BitReader.prototype.eat = function eat(amount, opts) {
  opts = opts || {}

  var offset, start, end, value, buf, buflen;
  amount = amount || 1;
  offset = this._offset;
  buf = this._buffer;
  buflen = buf.length;

  if (offset >= buflen)
    return null;

  start = offset;
  end = offset + amount;

  // we don't want to deal with oob errors so if we're trying to consume
  // past the boundary of the buffer, consume the rest.
  if (end >= buflen) {
    end = buflen;
    this.emit('empty')
  }

  value = buf.slice(start, end);
  this._offset = end;

  if (value.length === 0)
    return null;

  if (opts.integer) {
    var prefix = 'readInt'
    var endian = this.endianness;
    var methodName;

    if (!~[1, 2, 4].indexOf(amount)) {
      var err = new RangeError(util.format('Invalid value for amount `%s` when `opts.integer` is true, valid values are [1, 2, 4]', amount));
      throw err;
    }

    if (opts.endian) {
      endian = BitReader.interpretEndian(opts.endian);
      if (!endian) {
        var err = new TypeError(util.format('Invalid value for `opts.endian` %s', opts.endian));
        throw err;
      }
    }

    if (opts.signed === false)
      prefix = 'readUInt';

    methodName = prefix + (amount * 8);

    if (amount > 1)
      methodName += endian;

    return value[methodName](0);
  }
  return value;
};

/** convience methods */
BitReader.prototype.eatInt = function (amount, endian) {
  return this.eat(amount, { integer: true, signed: true, endian: endian });
};
BitReader.prototype.eatUInt = function (amount, endian) {
  return this.eat(amount, { integer: true, signed: false, endian: endian });
};
BitReader.prototype.eatBool = function () {
  return !!this.eatUInt(1);
};

/**
 * Like `BitReader#eat` but return a string (or `null`).
 *
 * @see BitReader#eat
 */

BitReader.prototype.eats = function eats(amount) {
  var value = this.eat(amount);
  return value ? value.toString() : null;
};

/**
 * Rewind the offset by `amount` bytes, or rewind it to the beginning.
 *
 * @param {Integer} amount number of bytes to rewind [default: 0, all the way]
 * @return {Integer} the new offset
 */

BitReader.prototype.rewind = function rewind(amount) {
  if (!amount) amount = this.position();
  this._offset -= amount
  return this;
};


/**
 * Get the current offset.
 *
 * @return {Integer} the offset
 */

BitReader.prototype.position = function position() {
  return this._offset;
};

/**
 * Get the value of the byte at the current offset.
 *
 * @return {Integer} byte at current offset
 */

BitReader.prototype.peak = function peak(amount) {
  var value = this.eat.apply(this, arguments);
  this.rewind(amount);
  return value;
};

/**
 * Like `BitReader#peak`, but converts to ascii string.
 *
 * @see BitReader#peak
 */

BitReader.prototype.peaks = function peaks(amount) {
  var value = this.peak(amount);
  return value ? value.toString() : null;
};

/**
 * Consume bytes until a separator or EOF is found.
 *
 * @param {Integer} sep byte to look for [default: 0]
 * @return {String}
 */

BitReader.prototype.eatString = function eatString(sep) {
  var errMsg = util.format('Separator must be a number between [0, 255] or a single character, got %s', sep);
  var typeErr = new TypeError(errMsg);
  var rangeErr = new RangeError(errMsg);

  // default the separator to null byte
  var buf, start, end, value;
  buf = this._buffer

  if (typeof sep === 'undefined')
    sep = 0;
  else if (typeof sep === 'string' && sep.length === 1)
    sep = sep.charCodeAt(0);
  else if (isNaN(sep))
    throw typeErr;

  if (sep < 0 || sep > 255)
    throw rangeErr;

  // we want to eat until we find the separator or until the end
  start = this._offset;
  while ((value = this.eat()) && value[0] !== sep);
  end = this._offset;

  if (start === end)
    return null;

  // if we aren't at the end of the buffer, slice a byte off the end so
  // we exclude the separator.
  if (end !== buf.length)
    end -= 1;

  return buf.slice(start, end).toString();
};

/**
 * Get all remaining bytes in buffer.
 *
 * @return {Buffer | null} remaining bytes in a buffer or null.
 */

BitReader.prototype.eatRemaining = function eatRemaining(opts) {
  opts = opts || {};
  var buf, start, value;
  buf = this._buffer;
  start = this._offset;

  if (!opts.chunkSize) {
    value = buf.slice(start, buf.length);
    this._offset = buf.length;
    if (value.length === 0)
      return null;
    return value;
  }

  var chunks = [];
  while ((value = this.eat(opts.chunkSize, opts)))
    chunks.push(value);
  return chunks;
};
BitReader.prototype.eatRest = BitReader.prototype.eatRemaining;

/**
 * Get a reference to the internal buffer
 *
 * @return {Buffer}
 */

BitReader.prototype.getBuffer = function getBuffer() {
  return this._buffer;
};


/**
 * Get number of remaining bytes in buffer
 */
BitReader.prototype.remaining = function remaining() {
  return this.getBuffer().length - this.position();
};

module.exports = BitReader;