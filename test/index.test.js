// @flow
const test = require('tape-promise/tape')
const fs = require('fs')
const Zip = require('../bundle')

test('index: create zip file', async (t) => {
  const zipfile = 'test/output.zip'

  t.pass('Reading directories "fixtures"')

  fs.unlinkSync(zipfile)

  const zipper = new Zip(zipfile, { level: 1 })
  await zipper.addDir('test/fixtures')
  const written = await zipper.finalize()
  t.pass(written + ' total bytes written')
})
