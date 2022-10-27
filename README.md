# zip-up

Simple zip module for Node.js

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

## Installation

```bash
$ npm install zip-up
```

## Usage

```js
import Zip from 'zip-up'
const zipper = new Zip('output.zip', { level: 1 })
await zipper.addDir('directory/to/zip')
await zipper.addDir('other/directory/to/zip')
const bytesWritten = await zipper.finalize()
// bytesWritten -> 276
```

# Options

Options can be passed as the second argument to `Zip.addDir()`:

```js
await zipper.addDir('directory', {
  ignoreHidden: true,
  exclude: ['/tmp/']
})
```

`ignoreHidden`: whether to ignore hidden files; i.e. files beginning with `.` (default: `false`).

`exclude`: array of paths to exclude (default: `[]`) **Note**: this applies to
files as well as directories.

## Testing

Run `npm test` to run the test suite. The tests insure that no errors occur and
also verifies that the file is created correctly by unzipping and examining the
file contents.

## Contributing

When submitting a PR for review, make sure that you include a test for your proposed
feature or fix.


