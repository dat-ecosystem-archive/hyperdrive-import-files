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
  if (!files || !files.length) return setImmediate(cb)
  files = Array.from(files)
  const prefix = common(files)
  const emitError = (err) => err && status.emit('error', err)
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

  const consume = (file, cb) => {
    fs.stat(file, (err, stat) => {
      if (err) return cb(err)
      if (stat.isDirectory()) consumeDir(file, cb)
      else consumeFile(file, cb)
    })
  }

  const consumeFile = (file, cb) => {
    status.fileCount++
    const rs = fs.createReadStream(file)
    const ws = archive.createFileWriteStream(relative(prefix, file))
    pump(rs, ws, cb || emitError)
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

  next()

  return status
}

