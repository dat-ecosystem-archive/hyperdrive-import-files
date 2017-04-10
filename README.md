
# hyperdrive-import-files

Import the contents of a folder into a [hyperdrive](https://github.com/mafintosh/hyperdrive), and optionally keep watching for changes.

[![Build Status](https://travis-ci.org/juliangruber/hyperdrive-import-files.svg?branch=master)](https://travis-ci.org/juliangruber/hyperdrive-import-files)

## Example

```js
const hyperdrive = require('hyperdrive')
const memdb = require('memdb')
const hyperImport = require('hyperdrive-import-files')

const drive = hyperdrive(memdb())
const archive = drive.createArchive()

hyperImport(archive, 'a/directory/', err => {
  // ...
})
```

## Installation

```bash
$ npm install hyperdrive-import-files
```

## API

### hyperImport(archive, target, [, options][, cb])

Recursively import `target`, which is the path to a directory or file,  into `archive` and call `cb` with the potential error. The import happens sequentually. Returns a `status` object.

Options

- `watch`: watch files for changes & import on change (archive must be live)
- `overwrite`: allow files in the archive to be overwritten (defaults to true)
- `compareFileContent`: compare import-candidates to archive's internal copy. If false, will only compare mtime and file-size, which is faster but may reslt in false-positives. (defaults to false)
- `basePath`: where in the archive should the files import to? (defaults to '')
- `ignore`: [anymatch](https://npmjs.org/package/anymatch) expression to ignore files
- `dryRun`: step through the import, but don't write any files to the archive (defaults to false)
- `indexing`: Useful if `target === dest` so hyperdrive does not rewrite the files on import.

To enable watching, set `watch: true`, like this:

```js
const status = hyperImport(archive, target, { watch: true }, err => {
  console.log('initial import done')
})
status.on('error', err => {
  // ...
})
// when you want to quit:
status.close()
```

If you want to import into a subfolder, set `basePath`:

```js
hyperImport(archive, target, { basePath: '/some/subdir' }, err => {...})
```

### status

Events:

- `error` (`err`)
- `file imported` ({ `path`, `mode=updated|created` })
- `file skipped` ({ `path` })
- `file watch event` ({ `path`, `mode=updated|created` })

Properties:

- `fileCount`: The count of currently known files
- `totalSize`: Total file size in bytes
- `bytesImported`: Amount of bytes imported so far

## License

MIT
