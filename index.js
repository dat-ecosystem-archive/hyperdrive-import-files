'use strict'

const pump = require('pump')
const fs = require('fs')
const join = require('path').join
const relative = require('path').relative
const EventEmitter = require('events').EventEmitter
const chokidar = require('chokidar')
const series = require('run-series')
const match = require('anymatch')

const noop = () => {}

module.exports = (archive, dir, opts, cb) => {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}

  const emitError = (err) => err && status.emit('error', err)
  cb = cb || emitError

  const entries = {}
  let watcher
  let liveListStream

  if (opts.live) {
    watcher = chokidar.watch([dir], {
      persistent: true,
      ignored: opts.ignore
    })
    watcher.on('add', path => consume(path))
    watcher.on('change', path => consume(path))
    watcher.on('unlink', path => noop) // TODO
  }

  const status = new EventEmitter()
  status.close = () => {
    if (watcher) watcher.close()
    if (liveListStream) liveListStream.destroy()
  }
  status.fileCount = 0
  status.totalSize = 0

  const consume = (file, cb) => {
    if (opts.ignore && match(opts.ignore, file)) return cb()
    fs.stat(file, (err, stat) => {
      if (err) return cb(err)
      if (stat.isDirectory()) {
        consumeDir(file, cb)
      } else {
        consumeFile(file, stat, cb)
      }
    })
  }

  const consumeFile = (file, stat, cb) => {
    cb = cb || emitError
    const hyperPath = relative(dir, file)
    const next = mode => {
      const rs = fs.createReadStream(file)
      const ws = archive.createFileWriteStream({
        name: hyperPath,
        mtime: stat.mtime
      })
      pump(rs, ws, err => {
        if (err) return cb(err)
        status.emit('file imported', {
          path: file,
          mode
        })
        cb()
      })
    }

    let entry = entries[hyperPath]
    if (!entry) {
      status.fileCount++
      status.totalSize += stat.size
      next('created')
    } else if (entry.length !== stat.size || entry.mtime !== stat.mtime.getTime()) {
      status.totalSize = status.totalSize - entry.length + stat.size
      next('updated')
    } else {
      status.emit('file skipped', { path: file })
      cb()
    }
  }

  const consumeDir = (file, cb) => {
    cb = cb || emitError
    fs.readdir(file, (err, _files) => {
      if (err) return cb(err)
      series(_files.map(_file => done => {
        consume(join(file, _file), done)
      }), cb)
    })
  }

  const next = () => {
    consumeDir(dir, err => {
      if (liveListStream && !opts.live) liveListStream.destroy()
      cb(err)
    })
  }

  if (opts.resume) {
    archive.list({ live: false })
    .on('error', cb)
    .on('data', entry => {
      console.log('initialStream', entry)
      entries[entry.name] = entry
      status.fileCount++
      status.totalSize += entry.length
    })
    .on('end', () => {
      liveListStream = archive.list({ live: true })
      .on('error', err => status.emit('error', err))
      .on('data', entry => {
        console.log('liveListStream', entry)
        entries[entry.name] = entry
      })
      next()
    })
  } else {
    next()
  }

  return status
}

