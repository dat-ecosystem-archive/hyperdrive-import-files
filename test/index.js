'use strict'

var test = require('tape')
var hyperdrive = require('hyperdrive')
var memdb = require('memdb')
var hyperImport = require('..')
var fs = require('fs')
var path = require('path')
var raf = require('random-access-file')

function sort (entries) {
  return entries.sort(function (a, b) {
    return a.name.localeCompare(b.name)
  })
}

test('cleanup', function (t) {
  var base = path.join(__dirname, '/fixture/a/b/c')
  fs.readdirSync(base)
  .filter(function (file) {
    return ['d.txt', 'e.txt'].indexOf(file) === -1
  })
  .forEach(function (file) {
    fs.unlinkSync(path.join(base, file))
  })
  t.end()
})

test('import directory', function (t) {
  t.plan(8)

  var drive = hyperdrive(memdb())
  var archive = drive.createArchive()
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'), function (err) {
    t.error(err)

    archive.list(function (err, entries) {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 3)
      t.equal(entries[0].name, '')
      t.equal(entries[1].name, 'd.txt')
      t.equal(entries[2].name, 'e.txt')
      t.equal(status.fileCount, 2)
      t.equal(status.totalSize, 9)
    })
  })
})

test('import file', function (t) {
  t.plan(6)

  var drive = hyperdrive(memdb())
  var archive = drive.createArchive()
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/d.txt'), function (err) {
    t.error(err)

    archive.list(function (err, entries) {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 1)
      t.equal(entries[0].name, 'd.txt')
      t.equal(status.fileCount, 1)
      t.equal(status.totalSize, 4)
    })
  })
})

test('resume', function (t) {
  t.plan(12)

  var drive = hyperdrive(memdb())
  var archive = drive.createArchive()
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'), {
    resume: true
  }, function (err) {
    t.error(err)
    archive.createFileWriteStream('d.txt').on('finish', function () {
      status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'), {
        resume: true
      }, function (err) {
        t.error(err)
      })
      status.on('file imported', function (file) {
        t.equal(file.mode, 'updated', 'updated')
        t.equal(status.fileCount, 3)
        t.equal(status.totalSize, 13)
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
    } else {
      t.equal(status.fileCount, 2)
      t.equal(status.totalSize, 9)
    }
  })
})

test('resume with raf', function (t) {
  t.plan(12)

  var drive = hyperdrive(memdb())
  var dir = path.join(__dirname, '/fixture/a/b/c/')
  var archive = drive.createArchive({
    file: function (name) {
      return raf(path.join(dir, name))
    }
  })
  var status = hyperImport(archive, dir, {
    resume: true
  }, function (err) {
    t.error(err)
    fs.writeFile(path.join(__dirname, '/fixture/a/b/c/d.txt'), 'foo\n', function () {
      status = hyperImport(archive, dir, {
        resume: true
      }, function (err) {
        t.error(err)
      })
      status.on('file imported', function (file) {
        if (file.path !== path.join(__dirname, '/fixture/a/b/c/d.txt')) t.fail('wrong file')
        t.equal(file.mode, 'updated', 'updated')
        t.equal(status.fileCount, 2)
        t.equal(status.totalSize, 9)
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
    } else {
      t.equal(status.fileCount, 2)
      t.equal(status.totalSize, 9)
    }
  })
})

if (!process.env.TRAVIS) {
  test('resume & live', function (t) {
    t.plan(10)

    var drive = hyperdrive(memdb())
    var archive = drive.createArchive()
    var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'), {
      resume: true,
      live: true
    }, function (err) {
      t.error(err, 'initial import')
      var tmp = path.join(__dirname, '/fixture/a/b/c/', Math.random().toString(16).slice(2))

      status.once('file imported', function (file) {
        t.equal(file.mode, 'created', 'created')
        t.equal(status.fileCount, 3, 'file count')
        t.equal(status.totalSize, 11, 'total size')

        status.once('file imported', function (file) {
          t.equal(file.mode, 'updated', 'updated')
          t.equal(status.fileCount, 3, 'file count')
          t.equal(status.totalSize, 12, 'total size')
          status.close()
          fs.unlink(tmp, function (err) { t.error(err, 'file removed') })
        })

        fs.writeFile(tmp, 'you', function (err) { t.error(err, 'file updated') })
      })
      fs.writeFile(tmp, 'yo', function (err) { t.error(err, 'file created') })
    })
  })
}

test('optional callback', function (t) {
  t.plan(1)

  var drive = hyperdrive(memdb())
  var archive = drive.createArchive()
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'))
  status.once('file imported', function () { t.ok(true) })
})

test('ignore', function (t) {
  var drive = hyperdrive(memdb())
  var archive = drive.createArchive()
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
  var drive = hyperdrive(memdb())
  var archive = drive.createArchive()
  var directory = path.join(__dirname, '/fixture/a/b/c/')

  hyperImport(archive, directory, function (err) {
    t.error(err)
    hyperImport(archive, directory, {
      resume: true
    }, function (err) {
      t.error(err)
      archive.list(function (err, entries) {
        t.error(err)

        entries = sort(entries)
        t.equal(entries.length, 3)
        t.equal(entries[0].name, '')
        t.equal(entries[1].name, 'd.txt')
        t.equal(entries[2].name, 'e.txt')
        t.end()
      })
    })
  })
})

test('import directory with basePath', function (t) {
  t.plan(8)

  var drive = hyperdrive(memdb())
  var archive = drive.createArchive()
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'), { basePath: 'foo/bar' }, function (err) {
    t.error(err)

    archive.list(function (err, entries) {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 3)
      t.equal(entries[0].name, 'foo/bar')
      t.equal(entries[1].name, 'foo/bar/d.txt')
      t.equal(entries[2].name, 'foo/bar/e.txt')
      t.equal(status.fileCount, 2)
      t.equal(status.totalSize, 9)
    })
  })
})

test('import file with basePath', function (t) {
  t.plan(6)

  var drive = hyperdrive(memdb())
  var archive = drive.createArchive()
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/d.txt'), { basePath: 'foo/bar' }, function (err) {
    t.error(err)

    archive.list(function (err, entries) {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 1)
      t.equal(entries[0].name, 'foo/bar/d.txt')
      t.equal(status.fileCount, 1)
      t.equal(status.totalSize, 4)
    })
  })
})

test('dry run', function (t) {
  var drive = hyperdrive(memdb())
  var archive = drive.createArchive()
  var filesAdded = []
  var status = hyperImport(archive, path.join(__dirname, '/fixture/a/b/c/'), { dryRun: true }, function (err) {
    t.error(err)

    archive.list(function (err, entries) {
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

// NOTE: this test must be last
test('chokidar bug', function (t) {
  // chokidar sometimes keeps the process open
  t.end()
  process.exit()
})
