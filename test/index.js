'use strict'

const test = require('tape')
const hyperdrive = require('hyperdrive')
const memdb = require('memdb')
const hyperImport = require('..')
const fs = require('fs')
const path = require('path')
const raf = require('random-access-file')

const sort = entries => entries.sort((a, b) => a.name.localeCompare(b.name))

test('cleanup', t => {
  const base = `${__dirname}/fixture/a/b/c`
  fs.readdirSync(base)
  .filter(file => ['d.txt', 'e.txt'].indexOf(file) === -1)
  .forEach(file => fs.unlinkSync(`${base}/${file}`))
  t.end()
})

test('import directory', t => {
  t.plan(8)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  const status = hyperImport(archive, `${__dirname}/fixture/a/b/c/`, err => {
    t.error(err)

    archive.list((err, entries) => {
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

test('import file', t => {
  t.plan(6)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  const status = hyperImport(archive, `${__dirname}/fixture/a/b/c/d.txt`, err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 1)
      t.equal(entries[0].name, 'd.txt')
      t.equal(status.fileCount, 1)
      t.equal(status.totalSize, 4)
    })
  })
})

test('resume', t => {
  t.plan(13)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  let status = hyperImport(archive, `${__dirname}/fixture/a/b/c/`, {
    resume: true
  }, err => {
    t.error(err)
    archive.createFileWriteStream('d.txt').on('finish', () => {
      status = hyperImport(archive, `${__dirname}/fixture/a/b/c/`, {
        resume: true
      }, err => {
        t.error(err)
        t.equal(status.fileCount, 2)
        t.equal(status.totalSize, 9)
      })
      status.on('file imported', file => {
        t.equal(file.mode, 'updated', 'updated')
        t.equal(file.path, `${__dirname}/fixture/a/b/c/d.txt`)
      })
      status.on('file skipped', file => {
        t.equal(file.path, `${__dirname}/fixture/a/b/c/e.txt`)
      })
    }).end('bleerg')
  })

  let i = 0
  status.on('file imported', file => {
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

test('resume with raf', t => {
  t.plan(12)

  const drive = hyperdrive(memdb())
  const dir = `${__dirname}/fixture/a/b/c/`
  const archive = drive.createArchive({
    file: function (name) {
      return raf(path.join(dir, name))
    }
  })
  let status = hyperImport(archive, dir, {
    resume: true
  }, err => {
    t.error(err)
    fs.writeFile(`${__dirname}/fixture/a/b/c/d.txt`, 'foo\n', () => {
      status = hyperImport(archive, dir, {
        resume: true
      }, err => {
        t.error(err)
      })
      status.on('file imported', file => {
        if (file.path !== `${__dirname}/fixture/a/b/c/d.txt`) t.fail('wrong file')
        t.equal(file.mode, 'updated', 'updated')
        t.equal(status.fileCount, 2)
        t.equal(status.totalSize, 9)
      })
      status.on('file skipped', file => {
        t.equal(file.path, `${__dirname}/fixture/a/b/c/e.txt`)
      })
    })
  })

  let i = 0
  status.on('file imported', file => {
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
  test('resume & live', t => {
    t.plan(10)

    const drive = hyperdrive(memdb())
    const archive = drive.createArchive()
    let status = hyperImport(archive, `${__dirname}/fixture/a/b/c/`, {
      resume: true,
      live: true
    }, err => {
      t.error(err, 'initial import')
      const tmp = `${__dirname}/fixture/a/b/c/${Math.random().toString(16).slice(2)}`

      status.once('file imported', file => {
        t.equal(file.mode, 'created', 'created')
        t.equal(status.fileCount, 3, 'file count')
        t.equal(status.totalSize, 11, 'total size')

        status.once('file imported', file => {
          t.equal(file.mode, 'updated', 'updated')
          t.equal(status.fileCount, 3, 'file count')
          t.equal(status.totalSize, 12, 'total size')
          status.close()
          fs.unlink(tmp, err => t.error(err, 'file removed'))
        })

        fs.writeFile(tmp, 'you', err => t.error(err, 'file updated'))
      })
      fs.writeFile(tmp, 'yo', err => t.error(err, 'file created'))
    })
  })
}

test('optional callback', t => {
  t.plan(1)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  let status = hyperImport(archive, `${__dirname}/fixture/a/b/c/`)
  status.once('file imported', () => t.ok(true))
})

test('ignore', t => {
  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  const status = hyperImport(archive, `${__dirname}/fixture/ignore`, {
    ignore: /\/\.dat\//,
    live: true
  }, err => {
    t.error(err, 'no error importing')
    fs.writeFile(`${__dirname}/fixture/ignore/.dat/beep.txt`, 'boop', err => {
      t.error(err, 'no error writing file')
      t.end()
      status.close()
    })
  })
  status.on('file imported', () => t.ok(false))
})

test('chokidar bug', t => {
  // chokidar sometimes keeps the process open
  t.end()
  process.exit()
})

