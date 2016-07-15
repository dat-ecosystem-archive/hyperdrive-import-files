'use strict'

const pump = require('pump')
const fs = require('fs')
const join = require('path').join
const relative = require('path').relative
const common = require('common-path-prefix')
const EventEmitter = require('events').EventEmitter
const chokidar = require('chokidar')
const series = require('run-series')

const noop = () => {}

module.exports = (archive, files, opts, cb) => {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}

  if (!files || !files.length) return setImmediate(cb || noop)
  files = Array.from(files)

  const emitError = (err) => err && status.emit('error', err)
  cb = cb || emitError

  const prefix = common(files)
  const entries = {}
  let watcher

  if (opts.live) {
    watcher = chokidar.watch([files], {
      persistent: true
    })
    watcher.on('add', path => consume(path))
    watcher.on('change', path => consume(path))
    watcher.on('unlink', path => noop) // TODO
  }

  const status = new EventEmitter()
  status.close = () => watcher && watcher.close()
  status.fileCount = 0
  status.totalSize = 0

  const consume = (file, cb) => {
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
    const hyperPath = relative(prefix, file)
    const next = mode => {
      const rs = fs.createReadStream(file)
      const ws = archive.createFileWriteStream({
        name: hyperPath,
        mtime: stat.mtime
      })
      pump(rs, ws, err => {
        if (err) return cb(err)
        entry = entries[hyperPath] = entry || {}
        entry.length = stat.size
        entry.mtime = stat.mtime.getTime()
        status.emit('file imported', {
          path: file,
          mode
        })
        cb()
      })
    }

    let entry = entries[hyperPath]
    if (!opts.resume || !entry) {
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

  const next = err => {
    if (err) return cb(err)
    const file = files.shift()
    if (!file) return cb()
    consume(file, next)
  }

  if (opts.resume) {
    archive.list({ live: false })
    .on('error', cb)
    .on('data', entry => {
      entries[entry.name] = entry
      status.fileCount++
      status.totalSize += entry.length
    })
    .on('end', next)
  } else {
    next()
  }

  return status
}

