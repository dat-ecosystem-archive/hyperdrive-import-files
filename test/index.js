'use strict'

var test = require('tape')
var hyperdrive = require('hyperdrive')
var hyperImport = require('..')
var fs = require('fs')
var path = require('path')
// var raf = require('random-access-file')
var os = require('os')
var rimraf = require('rimraf')

function tmpdir () {
  return fs.mkdtempSync(os.tmpdir() + path.sep + 'pauls-dat-api-test-')
}

function sort (entries) {
  return entries.sort(function (a, b) {
    return a.localeCompare(b)
  })
}

test('cleanup', function (t) {
  var base = path.join(__dirname, '/fixture/a/b/c')
  fs.readdirSync(base)
  .filter(function (file) {
    return ['d.txt', 'e.txt'].indexOf(file) === -1
  })
  .forEach(function (file) {
    rimraf.sync(path.join(base, file))
  })
  t.end()
})

test('import directory', function (t) {
  t.plan(8)

  var archive = hyperdrive(tmpdir())
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'), function (err) {
    t.error(err)

    archive.readdir('/', function (err, entries) {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 2)
      t.equal(entries[0], 'd.txt')
      t.equal(entries[1], 'e.txt')
      t.equal(status.fileCount, 2)
      t.equal(status.totalSize, 9)
      t.equal(status.bytesImported, 9)
    })
  })
})

test('import file', function (t) {
  t.plan(7)

  var archive = hyperdrive(tmpdir())
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/d.txt'), function (err) {
    t.error(err)

    archive.readdir('/', function (err, entries) {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 1)
      t.equal(entries[0], 'd.txt')
      t.equal(status.fileCount, 1)
      t.equal(status.totalSize, 4)
      t.equal(status.bytesImported, 4)
    })
  })
})

test('resume', function (t) {
  t.plan(15)

  var archive = hyperdrive(tmpdir())
  archive.ready(function () {
    var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'), function (err) {
      t.error(err)
      archive.createWriteStream('d.txt').on('finish', function () {
        status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'), function (err) {
          t.error(err)
          t.equal(status.fileCount, 2)
          t.equal(status.totalSize, 9)
          t.equal(status.bytesImported, 9)
        })
        status.on('file imported', function (file) {
          t.equal(file.mode, 'updated', 'updated')
        })
        status.on('file skipped', function (file) {
          t.equal(file.path, path.join(__dirname, '/fixture/a/b/c/e.txt'))
        })
      }).end('bleerg')
    })

    var i = 0
    status.on('file imported', function (file) {
      t.equal(file.mode, 'created', 'created')
      if (!i++) {
        t.equal(status.fileCount, 1)
        t.equal(status.totalSize, 4)
        t.equal(status.bytesImported, 4)
      } else {
        t.equal(status.fileCount, 2)
        t.equal(status.totalSize, 9)
        t.equal(status.bytesImported, 9)
      }
    })
  })
})

/*
TODO - disabled until hyperdrive supports {latest: true}
test('resume with raf', function (t) {
  t.plan(15)

  var dir = path.join(__dirname, '/fixture/a/b/c/')
  var archive = hyperdrive(dir)
  archive.ready(function() {
    var status = hyperImport(archive, dir, {
      resume: true
    }, function (err) {
      t.error(err)
      fs.writeFile(path.join(__dirname, '/fixture/a/b/c/d.txt'), 'foo\n', function () {
        status = hyperImport(archive, dir, {
          resume: true
        }, function (err) {
          t.error(err)
          t.equal(status.fileCount, 2)
          t.equal(status.totalSize, 9)
          t.equal(status.bytesImported, 9)
        })
        status.on('file imported', function (file) {
          if (file.path !== path.join(__dirname, '/fixture/a/b/c/d.txt')) t.fail('wrong file')
          t.equal(file.mode, 'updated', 'updated')
        })
        status.on('file skipped', function (file) {
          t.equal(file.path, path.join(__dirname, '/fixture/a/b/c/e.txt'))
        })
      })
    })

    var i = 0
    status.on('file imported', function (file) {
      t.equal(file.mode, 'created', 'created')
      if (!i++) {
        t.equal(status.fileCount, 1)
        t.equal(status.totalSize, 4)
        t.equal(status.bytesImported, 4)
      } else {
        t.equal(status.fileCount, 2)
        t.equal(status.totalSize, 9)
        t.equal(status.bytesImported, 9)
      }
    })
  })
}) */

if (!process.env.TRAVIS) {
  test('resume & live', function (t) {
    t.plan(13)

    var archive = hyperdrive(tmpdir())
    archive.ready(function () {
      var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'), {
        live: true
      }, function (err) {
        t.error(err, 'initial import')
        var tmp = path.join(__dirname, '/fixture/a/b/c/', Math.random().toString(16).slice(2))

        status.once('file imported', function (file) {
          t.equal(file.mode, 'created', 'created')
          t.equal(status.fileCount, 3, 'file count')
          t.equal(status.totalSize, 11, 'total size')
          t.equal(status.bytesImported, 11, 'bytes imported')

          status.once('file watch event', function (file) {
            t.equal(file.mode, 'updated', 'updated')
          })

          status.once('file imported', function (file) {
            t.equal(file.mode, 'updated', 'updated')
            t.equal(status.fileCount, 3, 'file count')
            t.equal(status.totalSize, 12, 'total size')
            t.equal(status.bytesImported, 14, 'bytes imported')
            status.close()
            fs.unlink(tmp, function (err) { t.error(err, 'file removed') })
          })

          fs.writeFile(tmp, 'you', function (err) { t.error(err, 'file updated') })
        })
        fs.writeFile(tmp, 'yo', function (err) { t.error(err, 'file created') })
      })
    })
  })
}

test('optional callback', function (t) {
  t.plan(1)

  var archive = hyperdrive(tmpdir())
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'))
  status.once('file imported', function () { t.ok(true) })
})

test('ignore', function (t) {
  var archive = hyperdrive(tmpdir())
  var status = hyperImport(archive, path.join(__dirname, '/fixture/ignore'), {
    ignore: /\/\.dat\//,
    live: true
  }, function (err) {
    t.error(err, 'no error importing')
    fs.writeFile(path.join(__dirname, '/fixture/ignore/.dat/beep.txt'), 'boop', function (err) {
      t.error(err, 'no error writing file')
      t.end()
      status.close()
    })
  })
  status.on('file imported', function () { t.ok(false) })
})

test('duplicate directory', function (t) {
  var archive = hyperdrive(tmpdir())
  var directory = path.join(__dirname, '/fixture/a/b/c/')

  hyperImport(archive, directory, function (err) {
    t.error(err)
    hyperImport(archive, directory, {
      resume: true
    }, function (err) {
      t.error(err)
      archive.readdir('/', function (err, entries) {
        t.error(err)

        entries = sort(entries)
        t.equal(entries.length, 2)
        t.equal(entries[0], 'd.txt')
        t.equal(entries[1], 'e.txt')
        t.end()
      })
    })
  })
})

test('duplicate subdirectory', function (t) {
  var archive = hyperdrive(tmpdir())
  var directory = path.join(__dirname, '/fixture/a/b/')

  hyperImport(archive, directory, function (err) {
    t.error(err)
    fs.utimes(path.join(directory, 'c'), 0, 0, function () {
      hyperImport(archive, directory, {
        resume: true
      }, function (err) {
        t.error(err)
        archive.readdir('/c', function (err, entries) {
          t.error(err)

          entries = sort(entries)
          t.equal(entries[0], 'd.txt')
          t.equal(entries[1], 'e.txt')
          t.end()
        })
      })
    })
  })
})

test('import directory with basePath', function (t) {
  t.plan(8)

  var archive = hyperdrive(tmpdir())
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'), { basePath: 'foo/bar' }, function (err) {
    t.error(err)

    archive.readdir('/foo/bar', function (err, entries) {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 2)
      t.equal(entries[0], 'd.txt')
      t.equal(entries[1], 'e.txt')
      t.equal(status.fileCount, 2)
      t.equal(status.totalSize, 9)
      t.equal(status.bytesImported, 9)
    })
  })
})

test('import file with basePath', function (t) {
  t.plan(7)

  var archive = hyperdrive(tmpdir())
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/d.txt'), { basePath: 'foo/bar' }, function (err) {
    t.error(err)

    archive.readdir('/foo/bar', function (err, entries) {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 1)
      t.equal(entries[0], 'd.txt')
      t.equal(status.fileCount, 1)
      t.equal(status.totalSize, 4)
      t.equal(status.bytesImported, 4)
    })
  })
})

test('dry run', function (t) {
  var archive = hyperdrive(tmpdir())
  var filesAdded = []
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'), { dryRun: true }, function (err) {
    t.error(err)

    archive.readdir('/', function (err, entries) {
      t.error(err)
      t.equal(entries.length, 0)
      t.equal(filesAdded.length, 2)
      t.equal(status.fileCount, 2)
      t.equal(status.totalSize, 9)
      t.end()
    })
  })
  status.on('file imported', function (e) {
    filesAdded.push(e)
  })
})

test('compareFileContent', function (t) {
  t.plan(13)

  var dir = path.join(__dirname, '/fixture/a/b/c/')
  var archive = hyperdrive(tmpdir())
  var status = hyperImport(archive, dir, function (err) {
    t.error(err)

    var dPath = path.join(__dirname, '/fixture/a/b/c/d.txt')
    fs.writeFileSync(dPath, fs.readFileSync(dPath))
    status = hyperImport(archive, dir, {
      resume: true,
      compareFileContent: true
    }, function (err) {
      t.error(err)
      t.equal(status.fileCount, 2)
      t.equal(status.totalSize, 9)
      t.equal(status.bytesImported, 9)
    })

    status.on('file imported', function (file) {
      t.fail('should not occur')
    })
  })

  var i = 0
  status.on('file imported', function (file) {
    t.equal(file.mode, 'created', 'created')
    if (!i++) {
      t.equal(status.fileCount, 1)
      t.equal(status.totalSize, 4)
      t.equal(status.bytesImported, 4)
    } else {
      t.equal(status.fileCount, 2)
      t.equal(status.totalSize, 9)
      t.equal(status.bytesImported, 9)
    }
  })
})

// NOTE: this test must be last
test('chokidar bug', function (t) {
  // chokidar sometimes keeps the process open
  t.end()
  process.exit()
})
