// @flow
const test = require('tape-promise/tape')
const fs = require('fs-extra')
const Zip = require('../bundle')

test('index: create zip file', async (t) => {
  const zipfile = 'test/output.zip'

  t.pass('Reading directories "fixtures"')

  try {
    fs.unlinkSync(zipfile)
  } catch (err) {
    // Ignore if not found
    //
    if (err.code !== 'ENOENT') {
      console.error(err)
      throw err
    }
  }

  const zipper = new Zip(zipfile, { level: 1 })
  await zipper.addDir('test/fixtures')
  const written = await zipper.finalize()
  t.pass(written + ' total bytes written')
})
