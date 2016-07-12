const hyperdrive = require('hyperdrive')
const memdb = require('memdb')
const hyperImport = require('.')

const drive = hyperdrive(memdb())
const archive = drive.createArchive()

hyperImport(archive, process.argv.slice(2), { live: true }, err => {
  if (err) throw err
  console.log('done')
  archive.list({ live: true }).on('data', console.log)
})
