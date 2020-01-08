// @flow
/* eslint no-multi-spaces: ["error", { ignoreEOLComments: true }] */
import crc32 from 'buffer-crc32'
import fs from 'fs'
import klaw from 'klaw'
import path from 'path'
import zlib from 'zlib'

import consts from './_consts'

// We must convert the date to the zip-format way. This is for the internal modification date.
function convertDate (d: Date): number {
  const year = d.getFullYear()

  if (year < 1980) {
    return (1 << 21) | (1 << 16)
  }
  return ((year - 1980) << 25) | ((d.getMonth() + 1) << 21) | (d.getDate() << 16) |
    (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
}

// Filter hidden.
function filterHidden (item: string) {
  const basename = path.basename(item)
  return basename === '.' || basename[0] !== '.'
}

// Return a flattened-out file list of a rootDir.
// Each entry consists of the filename (with path relative to `rootDir`).
// DOES NOT FOLLOW SYMLINKS
function readDirRecurse (rootDir: string, opts: Object): Promise {
  return new Promise((resolve, reject) => {
    rootDir = path.resolve(rootDir)
    const fileEntries = []
    const options = {}
    if (opts && opts.ignoreHidden) {
      options.filter = filterHidden
    }
    klaw(rootDir, options)
      .on('data', (item) => {
        let excluded = false
        if (opts && opts.excludeDirectories) {
          for (const dir of opts.excludeDirectories) {
            if (item.path.indexOf(dir) !== -1) {
              excluded = true
            }
          }
        }
        if (!item.stats.isDirectory() && !item.stats.isSymbolicLink() && !excluded) {
          fileEntries.push(path.relative(rootDir, item.path))
        }
      })
      .on('end', () => resolve(fileEntries))
      .on('error', (err, item) => {
        const msg = `Error! '${err.message}' in file '${item.path}'`
        reject(new Error(msg))
      })
  })
}

export default class Zip {
  constructor (zipFileName: string, opts: Object) {
    this.zipFileName = zipFileName
    this.queue = []
    this.fileptr = 0
    this.files = []
    this.options = opts
  }

  // Add a file to our zip archive.
  // This *must* return a Promise due to the fact that we have internal callbacks from zlib
  // and file stream events
  addFile (rootDir: string, fileName: string, targetDir: ?string): Promise {
    return new Promise((resolve, reject) => {
      const destFileName = targetDir
        ? path.join(targetDir, fileName)
        : fileName
      const checksumList = []
      const file = { name: destFileName }
      this._pushLocalFileHeader(file)

      const stream = fs.createReadStream(path.join(rootDir, fileName))
      let compressed = 0
      let uncompressed = 0

      const deflate = zlib.createDeflateRaw(this.options)

      deflate.on('data', (chunk) => {
        compressed += chunk.length
        this.queue.push(chunk)
      })

      deflate.on('end', () => {
        file.crc32 = crc32.signed(Buffer.concat(checksumList))
        file.compressed = compressed
        file.uncompressed = uncompressed

        this.fileptr += compressed
        this._pushDataDescriptor(file)

        this.files.push(file)
        resolve()
      })

      deflate.on('error', error => reject(error))

      stream.on('data', (chunk) => {
        uncompressed += chunk.length
        checksumList.push(Buffer.from(chunk))
        deflate.write(chunk)
      })

      stream.on('end', () => {
        deflate.end()
      })

      stream.on('error', error => reject(error))
    })
  }

  // Recurse down into a directory tree and add each file file. Use `targetDir`
  // as the toplevel dir in the zipfile.
  async addDir (srcDir: string, targetDir: ?string, options: ?Object) {
    const fileEntries = await readDirRecurse(srcDir, options)

    for (let entry of fileEntries) {
      try {
        await this.addFile(srcDir, entry, targetDir)
      } catch (error) {
        console.log(`Cannot add file ${entry} to ${targetDir}. Reason: ${error.message}`)
      }
    }
  }

  // You have to call this to finish out the zip file and write to disk.
  async finalize (): Promise {
    if (this.files.length === 0) {
      throw Error('no files in zip!')
    }

    return new Promise((resolve, reject) => {
      this._pushCentralDirectory()
      const outStream = fs.createWriteStream(this.zipFileName)
      for (let buf of this.queue) {
        outStream.write(buf)
      }
      outStream.on('finish', () => resolve(this.fileptr))
      outStream.end()
    })
  }

  // Internal method to create and output the local file header.
  _pushLocalFileHeader (file: Object) {
    file.version = 20
    file.bitflag = 8
    file.method = file.store ? 0 : 8
    file.moddate = convertDate(new Date())
    file.offset = this.fileptr

    const buf = Buffer.alloc(consts.LOCHDR + file.name.length)

    buf.writeUInt32LE(consts.LOCSIG, 0)                 // local file header signature
    buf.writeUInt16LE(file.version, consts.LOCVER)      // version needed to extract
    buf.writeUInt16LE(file.bitflag, consts.LOCFLG)      // general purpose bit flag
    buf.writeUInt16LE(file.method, consts.LOCHOW)       // compression method
    buf.writeUInt32LE(file.moddate, consts.LOCTIM)      // last mod file date and time

    buf.writeInt32LE(0, consts.LOCCRC)                  // crc32
    buf.writeUInt32LE(0, consts.LOCSIZ)                 // compressed size
    buf.writeUInt32LE(0, consts.LOCLEN)                 // uncompressed size

    buf.writeUInt16LE(file.name.length, consts.LOCNAM)  // file name length
    buf.writeUInt16LE(0, consts.LOCEXT)                 // extra field length
    buf.write(file.name, consts.LOCHDR)                 // file name

    this.queue.push(buf)
    this.fileptr += buf.length
  }

  _pushDataDescriptor (file: Object) {
    const buf = Buffer.alloc(consts.EXTHDR)
    buf.writeUInt32LE(consts.EXTSIG, 0)                 // data descriptor record signature
    buf.writeInt32LE(file.crc32, consts.EXTCRC)         // crc-32
    buf.writeUInt32LE(file.compressed, consts.EXTSIZ)   // compressed size
    buf.writeUInt32LE(file.uncompressed, consts.EXTLEN) // uncompressed size

    this.queue.push(buf)
    this.fileptr += buf.length
  }

  // Central directory is at the very end of the zipfile.
  _pushCentralDirectory () {
    const cdoffset = this.fileptr
    let ptr = 0
    let cdsize = 0
    let len = 0
    let buf = null

    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i]

      len = consts.CENHDR + file.name.length
      buf = Buffer.alloc(len)

      // central directory file header
      buf.writeUInt32LE(consts.CENSIG, 0)                 // central file header signature
      buf.writeUInt16LE(file.version, consts.CENVEM)      // version made by
      buf.writeUInt16LE(file.version, consts.CENVER)      // version needed to extract
      buf.writeUInt16LE(file.bitflag, consts.CENFLG)      // general purpose bit flag
      buf.writeUInt16LE(file.method, consts.CENHOW)       // compression method
      buf.writeUInt32LE(file.moddate, consts.CENTIM)      // last mod file time and date
      buf.writeInt32LE(file.crc32, consts.CENCRC)         // crc-32
      buf.writeUInt32LE(file.compressed, consts.CENSIZ)   // compressed size
      buf.writeUInt32LE(file.uncompressed, consts.CENLEN) // uncompressed size
      buf.writeUInt16LE(file.name.length, consts.CENNAM)  // file name length
      buf.writeUInt16LE(0, consts.CENEXT)                 // extra field length
      buf.writeUInt16LE(0, consts.CENCOM)                 // file comment length
      buf.writeUInt16LE(0, consts.CENDSK)                 // disk number where file starts
      buf.writeUInt16LE(0, consts.CENATT)                 // internal file attributes
      buf.writeUInt32LE(0, consts.CENATX)                 // external file attributes
      buf.writeUInt32LE(file.offset, consts.CENOFF)       // relative offset
      buf.write(file.name, consts.CENHDR)                 // file name

      ptr = ptr + len
      this.queue.push(buf)
    }

    cdsize = ptr

    // end of central directory record
    len = consts.ENDHDR
    buf = Buffer.alloc(len)

    buf.writeUInt32LE(consts.ENDSIG, 0)                   // end of central dir signature
    buf.writeUInt16LE(0, 4)                               // number of this disk
    buf.writeUInt16LE(0, 6)                               // disk where central directory starts
    buf.writeUInt16LE(this.files.length, consts.ENDSUB)   // number of central directory records on this disk
    buf.writeUInt16LE(this.files.length, consts.ENDTOT)   // total number of central directory records
    buf.writeUInt32LE(cdsize, consts.ENDSIZ)              // size of central directory in bytes
    buf.writeUInt32LE(cdoffset, consts.ENDOFF)            // offset of start of central directory, relative to start of archive
    buf.writeUInt16LE(0, consts.ENDCOM)                   // comment length

    ptr = ptr + len

    this.queue.push(buf)
    this.fileptr += ptr
  }
}
