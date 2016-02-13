#!/usr/bin/env node
var indexNet = require('../lib/')
var fs = require('mz/fs')
var log = require('debug')('index-net:update-list')
var path = require('path')

log('start updating')
indexNet.models.indexes()
.then((indexes) => {
  var pathSave = path.resolve(__dirname, '../.cache')
  var content = JSON.stringify(indexes, null, 2);
  return fs.writeFile(`${pathSave}/indexes.json`, content)
})
.then(() => {
  log('updated')
})
.catch((error) => {
  log(error.stack)
})
