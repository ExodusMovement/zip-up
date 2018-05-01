# zip-up

Simple zip module for Node.js

**NOTE:** This module uses `async`/`await`; must use Node v7.6.0 or higher.

## Usage

```js
import Zip from 'zip-up'
const zipper = new Zip('output.zip', { level: 1 })
await zipper.addDir('directory/to/zip')
const bytesWritten = await zipper.finalize()
// bytesWritten -> 276
```

## Testing

Run `npm test` to run a simple test suite; this tests that no errors occur, but it does not test that the file is created correctly. Please manually inspect `test/output.zip` and ensure it matches the files in `test/fixtures`.
