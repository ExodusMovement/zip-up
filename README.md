# zip-up

Simple zip module for Node.js

**NOTE:** This module uses `async`/`await`; must use Node v7.6.0 or higher.

## Introduction

I created this project because there isn't a simple, easy to use zip reader for
NodeJS which has few dependencies and simple in implementation. When searching
for such a project, I came across this one:

https://www.npmjs.com/package/node-stream-zip

However, it is no longer supported, and the tip is broken. I wanted to be able
to use Node's built in zlib support, and the author had already done the
legwork. He also had code which output correct zip headers. All I had to do is
make sure the file itself streams properly to the output file in question using
Node streams. I hope it proves as useful to you as it did to me!

What was needed was the ability to add multiple files and directories into a
single zip file without having to have a staging folder on the harddrive. Yes,
this means everything is done in memory, so be mindful of file sizes and the
available RAM on the target machine.

## Usage

```js
import Zip from 'zip-up'
const zipper = new Zip('output.zip', { level: 1 })
await zipper.addDir('directory/to/zip')
await zipper.addDir('other/directory/to/zip')
const bytesWritten = await zipper.finalize()
// bytesWritten -> 276
```

## Testing

Run `npm test` to run a simple test suite; this tests that no errors occur, but
it does not test that the file is created correctly. Please manually inspect
`test/output.zip` and ensure it matches the files in `test/fixtures`.

Admittedly it's a down and dirty test, but it is enough to exercise the library
properly and it also provides a sample usage.
