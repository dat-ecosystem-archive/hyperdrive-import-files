'use strict'

const pump = require('pump')
const fs = require('fs')
const {join, relative} = require('path')
const common = require('common-path-prefix')

module.exports = (archive, files, cb) => {
  if (!files || !files.length) return setImmediate(cb)
  files = Array.from(files)
  const prefix = common(files)

  const next = () => {
    const file = files.shift()
    if (!file) return cb()
    fs.stat(file, (err, stat) => {
      if (err) return cb(err)
      if (stat.isDirectory()) {
        fs.readdir(file, (err, _files) => {
          if (err) return cb(err)
          for (let _file of _files) {
            files.unshift(join(file, _file))
          }
          next()
        })
      } else {
        const rs = fs.createReadStream(file)
        const ws = archive.createFileWriteStream(relative(prefix, file))
        pump(rs, ws, err => {
          if (err) return cb(err)
          next()
        })
      }
    })
  }

  next()
}

