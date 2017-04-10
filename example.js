var hyperdrive = require('hyperdrive')
var ram = require('random-access-memory')
var hyperImport = require('.')

var archive = hyperdrive(ram)

var target = process.argv.slice(2)[0]

var status = hyperImport(archive, target, { watch: true }, function (err) {
  if (err) throw err
  console.log('done')
  console.log('file count', status.fileCount)
})

status.on('file imported', function (s) {
  console.log('file imported %s %s', s.path, s.mode)
})
