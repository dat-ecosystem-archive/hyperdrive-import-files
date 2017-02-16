var hyperdrive = require('hyperdrive')
var memdb = require('memdb')
var hyperImport = require('.')

var drive = hyperdrive(memdb())
var archive = drive.createArchive()

var target = process.argv.slice(2)[0]

var status = hyperImport(archive, target, { live: true }, function (err) {
  if (err) throw err
  console.log('done')
  console.log('file count', status.fileCount)
})

status.on('file imported', function (s) {
  console.log('file imported %s %s', s.path, s.mode)
})
