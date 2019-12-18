const test = require('tape-promise/tape')
const fs = require('fs-extra')
const Unzip = require('node-stream-zip')

const Zip = require('../bundle')

test('index: create zip file', async (t) => {
  const zipfile = './test/output.zip'

  t.pass('Reading directory "fixtures"')

  async function createZip () {
    if (await fs.exists(zipfile)) {
      await t.doesNotReject(fs.unlink(zipfile), null, 'zipfile unlinks')
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
        console.log('error found!')
        console.error(err)
        reject(err)
      })

      unzip.on('ready', async () => {
        resolve(unzip)
      })
    })
  }

  const zipper = await createZip()

  t.test('zip fixtures, no hidden dir', async (t) => {
    await zipper.addDir('test/fixtures', 'test/fixtures', true /* ignoreHidden */)
    const written = await zipper.finalize()
    t.pass(written + ' total bytes written')

    const unzip = await createUnzip()
    const files = Object.keys(unzip.entries()).sort()
    t.deepEqual(files, ['test/fixtures/a.txt', 'test/fixtures/b/c.txt'], 'should be no hidden folder')
    t.end()
  })

  t.test('zip fixtures with hidden dir', async (t) => {
    await zipper.addDir('test/fixtures/.d', 'test/fixtures/.d', false /* ignoreHidden */)
    const hiddenWritten = await zipper.finalize()
    t.pass(hiddenWritten + ' total bytes written')

    const unzip = await createUnzip()
    const files = Object.keys(unzip.entries()).sort()
    t.deepEqual(files, ['test/fixtures/.d/e.txt', 'test/fixtures/a.txt', 'test/fixtures/b/c.txt'], 'all files including hidden folder')
    t.end()
  })
})
