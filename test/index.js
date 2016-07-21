'use strict'

const test = require('tape')
const hyperdrive = require('hyperdrive')
const memdb = require('memdb')
const hyperImport = require('..')
const fs = require('fs')

const sort = entries => entries.sort((a, b) => a.name.localeCompare(b.name))

test('import', t => {
  t.plan(7)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  const status = hyperImport(archive, `${__dirname}/fixture/a/b/c/`, err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 2)
      t.equal(entries[0].name, 'd.txt')
      t.equal(entries[1].name, 'e.txt')
      t.equal(status.fileCount, 2)
      t.equal(status.totalSize, 9)
    })
  })
})

test('resume', t => {
  t.plan(12)

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
      })
      status.on('file imported', file => {
        t.equal(file.mode, 'updated', 'updated')
        t.equal(status.fileCount, 3)
        t.equal(status.totalSize, 13)
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

