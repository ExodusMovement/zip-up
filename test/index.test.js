const test = require('tape-promise/tape')
const fs = require('fs-extra')
const Unzip = require('node-stream-zip')

const Zip = require('../bundle')

async function doesNotReject (t, promise, msg) {
  t.doesNotReject(promise, null, msg)
  return promise
}

const zipfile = './test/output.zip'

async function createZip () {
  if (await fs.exists(zipfile)) {
    await fs.unlink(zipfile)
  }
  return new Zip(zipfile, { level: 1 })
}

function createUnzip () {
  return new Promise((resolve, reject) => {
    const unzip = new Unzip({
      file: zipfile,
      storeEntries: true,
      skipEntryNameValidation: true // if there are backslashes, ignore them
    })

    unzip.on('error', (err) => {
      reject(err)
    })

    unzip.on('ready', async () => {
      resolve(unzip)
    })
  })
}

test('index: create zip file', async t => {
  t.pass('Reading directory "fixtures"')

  let zipper

  t.test('zip fixtures, no hidden dir', async t => {
    try {
      zipper = await doesNotReject(t, createZip(), 'createZip does not reject')
      await zipper.addDir('test/fixtures', 'test/fixtures', {
        ignoreHidden: true
      })
      const written = await doesNotReject(
        t,
        zipper.finalize(),
        'Finalize without rejection'
      )
      t.pass(written + ' total bytes written')

      const unzip = await doesNotReject(
        t,
        createUnzip(),
        'create unzip without rejection'
      )
      const files = Object.keys(unzip.entries()).sort()
      t.deepEqual(
        files,
        ['test/fixtures/a.txt', 'test/fixtures/b/c.txt', 'test/fixtures/f/g.txt'],
        'should be no hidden folder'
      )
      t.end()
    } catch (err) {
      // If this throws, we still need to catch the exception otherwise it's unhandled.
    }
  })

  t.test('add hidden dir', async t => {
    try {
      await zipper.addDir('test/fixtures/.d', 'test/fixtures/.d')
      const written = await doesNotReject(
        t,
        zipper.finalize(),
        'Finalize without rejection'
      )
      t.pass(written + ' total bytes written')

      const unzip = await doesNotReject(
        t,
        createUnzip(),
        'create unzip without rejection'
      )
      const files = Object.keys(unzip.entries()).sort()
      t.deepEqual(
        files,
        [
          'test/fixtures/.d/e.txt',
          'test/fixtures/a.txt',
          'test/fixtures/b/c.txt',
          'test/fixtures/f/g.txt'
        ],
        'all files including hidden folder'
      )
    } catch (err) {
      // If this throws, we still need to catch the exception otherwise it's unhandled.
    }
    t.end()
  })

  t.test('zip fixtures excluded dir and hidden', async t => {
    try {
      zipper = await doesNotReject(t, createZip(), 'createZip does not reject')
      await zipper.addDir('test/fixtures', 'test/fixtures', {
        ignoreHidden: true,
        excludeDirectories: 'test/fixtures/f'
      })
      const written = await doesNotReject(
        t,
        zipper.finalize(),
        'Finalize without rejection'
      )
      t.pass(written + ' total bytes written')

      const unzip = await doesNotReject(
        t,
        createUnzip(),
        'create unzip without rejection'
      )
      const files = Object.keys(unzip.entries()).sort()
      t.deepEqual(
        files,
        ['test/fixtures/a.txt', 'test/fixtures/b/c.txt'],
        'all files except hidden and ignored dir'
      )
    } catch (err) {
      // If this throws, we still need to catch the exception otherwise it's unhandled.
    }
    t.end()
  })
})
