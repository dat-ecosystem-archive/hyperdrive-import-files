'use strict'

const test = require('tape')
const hyperdrive = require('hyperdrive')
const memdb = require('memdb')
const hyperImport = require('..')

const sort = entries => entries.sort((a, b) => b.name - a.name)

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
  t.plan(4)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  hyperImport(archive, [
    `${__dirname}/fixture/a/b/c/d.txt`
  ], err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      t.equal(entries.length, 1)
      t.equal(entries[0].name, 'd.txt')
    })
  })
})

test('multiple files', t => {
  t.plan(5)

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
      t.equal(entries[0].name, 'd.txt')
      t.equal(entries[1].name, 'e.txt')
    })
  })
})

test('directory', t => {
  t.plan(5)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  hyperImport(archive, [
    `${__dirname}/fixture/a/b`
  ], err => {
    t.error(err)

    archive.list((err, entries) => {
      t.error(err)
      entries = sort(entries)
      t.equal(entries.length, 2)
      t.equal(entries[0].name, 'b/c/d.txt')
      t.equal(entries[1].name, 'b/c/e.txt')
    })
  })
})

test('files and directories', t => {
  t.plan(6)

  const drive = hyperdrive(memdb())
  const archive = drive.createArchive()
  hyperImport(archive, [
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
    })
  })
})
