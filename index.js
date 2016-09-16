'use strict'

const pump = require('pump')
const fs = require('fs')
const join = require('path').join
const relative = require('path').relative
const basename = require('path').basename
const EventEmitter = require('events').EventEmitter
const chokidar = require('chokidar')
const series = require('run-series')
const match = require('anymatch')

const noop = () => {}

module.exports = (archive, target, opts, cb) => {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}

  const emitError = (err) => err && status.emit('error', err)
  cb = cb || emitError

  const entries = {}
  let watcher

  if (opts.live) {
    watcher = chokidar.watch([target], {
      persistent: true,
      ignored: opts.ignore
    })
    watcher.once('ready', () => {
      watcher.on('add', path => consume(path))
      watcher.on('change', path => consume(path))
      watcher.on('unlink', path => noop) // TODO
    })
  }

  const status = new EventEmitter()
  status.close = () => watcher && watcher.close()
  status.fileCount = 0
  status.totalSize = 0

  const consume = (file, cb) => {
    if (opts.ignore && match(opts.ignore, file)) return cb()
    fs.stat(file, (err, stat) => {
      if (err) return cb(err)
      if (stat.isDirectory()) {
        consumeDir(file, stat, cb)
      } else {
        consumeFile(file, stat, cb)
      }
    })
  }

  const consumeFile = (file, stat, cb) => {
    cb = cb || emitError
    const hyperPath = file === target
      ? basename(file)
      : relative(target, file)
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
        status.fileCount++
        status.totalSize += stat.size
        status.emit('file imported', {
          path: file,
          mode
        })
        cb()
      })
    }

    let entry = entries[hyperPath]
    if (!entry) {
      next('created')
    } else if (entry.length !== stat.size || entry.mtime !== stat.mtime.getTime()) {
      next('updated')
    } else {
      status.fileCount++
      status.totalSize += entry.length
      status.emit('file skipped', { path: file })
      cb()
    }
  }

  const consumeDir = (file, stat, cb) => {
    cb = cb || emitError
    archive.append({
      name: relative(target, file),
      type: 'directory',
      mtime: stat.mtime
    }, () => {
      fs.readdir(file, (err, _files) => {
        if (err) return cb(err)
        series(_files.map(_file => done => {
          consume(join(file, _file), done)
        }), cb)
      })
    })
  }

  const next = () => {
    consume(target, cb || emitError)
  }

  if (opts.resume) {
    archive.list({ live: false })
    .on('error', cb)
    .on('data', entry => {
      if (entry.type === 'directory') return
      entries[entry.name] = entry
    })
    .on('end', next)
  } else {
    next()
  }

  return status
}

