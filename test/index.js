'use strict'

const test = require('tape')
const hyperdrive = require('hyperdrive')
const memdb = require('memdb')
const hyperImport = require('..')

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
  t.plan(3)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  hyperImport(archive, [
    `${__dirname}/fixture/a/b/c/d.txt`
  ], err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      t.equal(entries.length, 1)
    })
  })
})

test('multiple files', t => {
  t.plan(3)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  hyperImport(archive, [
    `${__dirname}/fixture/a/b/c/d.txt`,
    `${__dirname}/fixture/a/b/c/e.txt`
  ], err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      t.equal(entries.length, 2)
    })
  })
})

test('directory', t => {
  t.plan(3)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  hyperImport(archive, [
    `${__dirname}/fixture/a/b/c/`
  ], err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      t.equal(entries.length, 2)
    })
  })
})

test('files and directories', t => {
  t.plan(3)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  hyperImport(archive, [
    `${__dirname}/fixture/a/b/c/`,
    `${__dirname}/index.js`
  ], err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      t.equal(entries.length, 3)
    })
  })
})
