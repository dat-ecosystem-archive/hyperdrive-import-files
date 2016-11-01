var hyperdrive = require('hyperdrive')
var memdb = require('memdb')
var hyperImport = require('.')

var drive = hyperdrive(memdb())
var archive = drive.createArchive()

var status = hyperImport(archive, process.argv.slice(2), { live: true }, function (err) {
  if (err) throw err
  console.log('done')
  console.log('file count', status.fileCount)
})
