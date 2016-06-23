var sinon = require('sinon');
var t = require('tap');
var PassThrough = require('stream').PassThrough;

var proxyquire = require('proxyquire');
var s3Stub = {};
var s3Files = proxyquire('../s3-files.js', {
  'aws-sdk': { 'S3': sinon.stub().returns(s3Stub) }
});



// Connect
t.type(s3Files.s3, undefined);
s3Files.connect({});
t.type(s3Files.s3, 'object');

// Keystream
var keyStream = s3Files.createKeyStream(undefined, []);
t.same(keyStream, null);
var keyStream = s3Files.createKeyStream('folder', undefined);
t.same(keyStream, null);


t.test('keyStream', function (child) {
  var keyStream = s3Files.createKeyStream('folder/', ['a','b']);
  var cnt = 0;
  keyStream.on('data', function (chunk) {
    if (cnt === 0) child.equal(chunk.toString(), 'folder/a');
    if (cnt === 1) child.equal(chunk.toString(), 'folder/b');
    cnt++;
  });
  keyStream.on('end', function () {
    child.end();
  });
});


// Filestream
t.test('Filestream needs a bucket', function (child) {
  var fileStream = s3Files.createFileStream();
  child.same(fileStream, null);

  var keyStream = s3Files
    .connect({ bucket: 'bucket' })
    .createKeyStream('folder/', ['a','b']);

  var s = new PassThrough();
  s.end('hi');
  var readStream = { createReadStream: function () { return s; } };
  s3Stub.getObject = function () { return readStream; };
  var cnt = 0;
  var fileStream = s3Files.createFileStream(keyStream);

  fileStream.on('data', function (chunk) {
    child.equal(chunk.data.toString(), 'hi');
    if (cnt === 0) child.equal(chunk.path, 'a');
    if (cnt === 1) {
      child.equal(chunk.path, 'b');
      child.end();
    }
    cnt++;
  });
});

t.test('Filestream passes errors back', function (child) {
  var keyStream2 = s3Files
    .connect({ bucket: 'bucket' })
    .createKeyStream('folder/', ['a','b']);

  var fileStream = s3Files.createFileStream(keyStream2);
  var s = new PassThrough();
  var readStream = { createReadStream: function () { return s; } };

  s3Stub.getObject = function () { return readStream; };

  var spy = sinon.spy(s3Stub, "getObject");

  fileStream.on('data', function (chunk) {
    spy.called();
  });

  fileStream.on('error', function (err) {
    console.log("got this error - ", err);
    t.match(err.message, 'hmmm');
    child.end();
  });

  s.write('hi');
  s.emit('error', new Error("hmmm"));
  t.same(spy.threw(), true);
});

t.end();
