'use strict'

const test = require('tape')
const hyperdrive = require('hyperdrive')
const memdb = require('memdb')
const hyperImport = require('..')
const fs = require('fs')

const sort = entries => entries.sort((a, b) => a.name.localeCompare(b.name))

test('no files', t => {
  t.plan(6)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  hyperImport(archive, null, err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      t.equal(entries.length, 0)

      hyperImport(archive, [], err => {
        t.error(err)

        archive.list((err, entries) => {
          t.error(err)
          t.equal(entries.length, 0)
        })
      })
    })
  })
})

test('single file', t => {
  t.plan(7)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  const status = hyperImport(archive, [
    `${__dirname}/fixture/a/b/c/d.txt`
  ], err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      t.equal(entries.length, 1)
      t.equal(entries[0].name, 'd.txt')
      t.equal(status.fileCount, 1)
      t.equal(status.totalSize, 4)
    })
  })
  status.on('file imported', file => {
    t.equal(file, `${__dirname}/fixture/a/b/c/d.txt`)
  })
})

test('multiple files', t => {
  t.plan(7)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  const status = hyperImport(archive, [
    `${__dirname}/fixture/a/b/c/d.txt`,
    `${__dirname}/fixture/a/b/c/e.txt`
  ], err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      t.equal(entries.length, 2)
      t.equal(entries[0].name, 'd.txt')
      t.equal(entries[1].name, 'e.txt')
      t.equal(status.fileCount, 2)
      t.equal(status.totalSize, 9)
    })
  })
})

test('directory', t => {
  t.plan(7)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  const status = hyperImport(archive, [
    `${__dirname}/fixture/a/b`
  ], err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 2)
      t.equal(entries[0].name, 'b/c/d.txt')
      t.equal(entries[1].name, 'b/c/e.txt')
      t.equal(status.fileCount, 2)
      t.equal(status.totalSize, 9)
    })
  })
})

test('files and directories', t => {
  t.plan(8)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  const status = hyperImport(archive, [
    `${__dirname}/fixture/a/b/c/`,
    `${__dirname}/index.js`
  ], err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 3)
      t.equal(entries[0].name, 'fixture/a/b/c/d.txt')
      t.equal(entries[1].name, 'fixture/a/b/c/e.txt')
      t.equal(entries[2].name, 'index.js')
      t.equal(status.fileCount, 3)
      t.equal(status.totalSize, 9 + fs.statSync(`${__dirname}/index.js`).size)
    })
  })
})

test('resume', t => {
  t.plan(6)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  let status = hyperImport(archive, [
    `${__dirname}/fixture/a/b/c/`
  ], {
    resume: true
  }, err => {
    t.error(err)
    status = hyperImport(archive, [
      `${__dirname}/fixture/a/b/c/`
    ], {
      resume: true
    }, err => {
      t.error(err)
    })
    status.on('file imported', (_, updated) => t.ok(updated))
  })
  status.on('file imported', (_, updated) => t.notOk(updated))
})

test('optional callback', t => {
  t.plan(1)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  let status = hyperImport(archive, [
    `${__dirname}/fixture/a/b/c/d.txt`
  ])
  status.on('file imported', () => t.ok(true))
})
