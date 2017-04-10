'use strict'

var pump = require('pump')
var fs = require('fs')
var join = require('path').join
var relative = require('path').relative
var basename = require('path').basename
var EventEmitter = require('events').EventEmitter
var chokidar = require('chokidar')
var series = require('run-series')
var match = require('anymatch')
var through = require('through2')
var isDuplicate = require('hyperdrive-duplicate')

var noop = function () {}

module.exports = function (archive, target, opts, done) {
  if (typeof opts === 'function') {
    done = opts
    opts = {}
  }
  opts = opts || {}
  var watch = opts.watch || opts.live

  var overwrite = opts.overwrite !== false
  var dryRun = opts.dryRun === true
  var compareFileContent = opts.compareFileContent === true
  function emitError (err) {
    if (err) status.emit('error', err)
  }
  done = done || emitError

  var basePath = (typeof opts.basePath === 'string') ? opts.basePath : ''
  var watcher
  var isWatching = false

  if (watch && archive.live) {
    watcher = chokidar.watch([target], {
      persistent: true,
      ignored: opts.ignore
    })
    watcher.once('ready', function () {
      watcher.on('add', function (file, stat) {
        status.emit('file watch event', {path: file, mode: 'created'})
        consume(file, stat)
      })
      watcher.on('change', function (file, stat) {
        status.emit('file watch event', {path: file, mode: 'updated'})
        consume(file, stat)
      })
      watcher.on('unlink', noop) // TODO
    })
  }

  var status = new EventEmitter()
  status.close = function () { watcher && watcher.close() }
  status.fileCount = 0
  status.totalSize = 0
  status.bytesImported = 0

  function consume (file, stat, cb) {
    cb = cb || emitError
    if (opts.ignore && match(opts.ignore, file)) return cb()
    if (stat) {
      onstat(stat)
    } else {
      fs.stat(file, function (err, stat) {
        if (err) return cb(err)
        onstat(stat)
      })
    }

    function onstat (stat) {
      if (stat.isDirectory()) {
        consumeDir(file, stat, cb)
      } else {
        consumeFile(file, stat, cb)
      }
    }
  }

  function consumeFile (file, stat, cb) {
    cb = cb || emitError
    var hyperPath = file === target
      ? joinHyperPath(basePath, basename(file))
      : joinHyperPath(basePath, relative(target, file))

    archive.stat(hyperPath, function (err, st) {
      if (overwrite) return add(st)
      if (err && !st) return add()
      status.emit('file skipped', { path: file })
      cb()
    })

    function add (entry) {
      // update the stats according to whether this is the initial import
      if (!isWatching) {
        // initial import, just add
        status.fileCount++
        status.totalSize += stat.size
      } else {
        if (entry) {
          // watch update to existing file, remove old and add new
          status.totalSize -= entry.size
          status.totalSize += stat.size
        } else {
          // watch addition, just add
          status.fileCount++
          status.totalSize += stat.size
        }
      }
      if (!entry) {
        next('created')
      } else if (entry.size !== stat.size || entry.mtime !== stat.mtime.getTime()) {
        if (compareFileContent) {
          isDuplicate(archive, file, hyperPath, function (err, duplicate) {
            if (!err && duplicate) return skip()
            next('updated')
          })
        } else {
          next('updated')
        }
      } else {
        skip()
      }

      function skip () {
        status.bytesImported += stat.size
        status.emit('file skipped', { path: file })
        cb()
      }
    }

    function next (mode) {
      if (dryRun) {
        return pumpDone()
      }
      var rs = fs.createReadStream(file)
      var ws = archive.createWriteStream(hyperPath, {indexing: opts.indexing})
      var increment = through(function (chunk, enc, cb) {
        status.bytesImported += chunk.length
        cb(null, chunk)
      })

      pump(rs, increment, ws, pumpDone)
      function pumpDone (err) {
        if (err) return cb(err)
        status.emit('file imported', {
          path: file,
          mode: mode
        })
        cb()
      }
    }
  }

  function consumeDir (file, stat, cb) {
    cb = cb || emitError
    var hyperPath = joinHyperPath(basePath, relative(target, file))

    function next () {
      fs.readdir(file, function (err, _files) {
        if (err) return cb(err)
        series(_files.map(function (_file) {
          return function (cb2) {
            consume(join(file, _file), null, cb2)
          }
        }), cb)
      })
    }

    if (dryRun) {
      next()
    } else {
      archive.stat(hyperPath, function (err, st) {
        if (!err && st) next()
        else archive.mkdir(hyperPath, next)
      })
    }
  }

  consume(target, null, function (err) {
    isWatching = true
    done(err)
  })

  return status
}

function normalizeEntryPath (path) {
  if (typeof path === 'string' && path.charAt(0) === '/') {
    return path.slice(1)
  }
  return path
}

function joinHyperPath (base, path) {
  path = join(base, path)
  if (path === '.') {
    // '.' is returned when base is '' and path is '': aka, the root directory
    // in hyperdrive, root should be '' or '/', so we replace it with this special case
    return ''
  }
  return normalizeEntryPath(path)
}
