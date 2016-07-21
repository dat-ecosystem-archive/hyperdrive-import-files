
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

### hyperImport(archive, directory, [, options][, cb])

Recursively import `directory` into `archive` and call `cb` with the potential error. The import happens sequentually. Returns a `status` object.

Options

- `live`: keep watching
- `resume`: assume the archive isn't fresh
- `ignore`: [anymatch](https://npmjs.org/package/anymatch) expression to ignore files

To enable watching, set `live: true`, like this:

```js
const status = hyperImport(archive, directory, { live: true }, err => {
  console.log('initial import done')  
})
status.on('error', err => {
  // ...  
})
// when you want to quit:
status.close()
```

If you want to resume importing an already existing archive, set `resume: true `. This module then checks a file's size and mtime to determine whether it needs to be updated or created.

### status

Events:

- `error` (`err`)
- `file imported` (`path`, `updated?`)

Properties:

- `fileCount`: The count of currently known files
- `totalSize`: Total file size in bytes

## License

MIT
