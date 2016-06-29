
# hyperdrive-import-files

Import some files and folders into a [hyperdrive](https://github.com/mafintosh/hyperdrive).

[![Build Status](https://travis-ci.org/juliangruber/hyperdrive-import-files.svg?branch=master)](https://travis-ci.org/juliangruber/hyperdrive-import-files)

## Example

```js
const hyperdrive = require('hyperdrive')
const memdb = require('memdb')
const hyperImport = require('hyperdrive-import-files')

const drive = hyperdrive(memdb())
const archive = drive.createArchive()

hyperImport(archive, [
  'a/directory/',
  'some/file.txt'
], err => {
  // ...
})
```

## Installation

```bash
$ npm install hyperdrive-import-files
```

## API

### hyperImport(archive, files, cb)

Recursively import `files` into `archive` and call `cb` with the potential error. The import happens sequentually.

## License

MIT
