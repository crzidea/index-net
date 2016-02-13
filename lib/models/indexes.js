var log = require('debug')('index-net:models:indexes')
var common = require('../common.js')
var cached = require('../../.cache/indexes.json')

function indexes() {
  return common.fetchAPI(indexes.api)
  .then((body) => {
    return body.data
  })
}
indexes.api = '/api/idx/getIdx.json'
indexes.find = (ticker) => {
  return cached.find((index) => ticker === index.ticker)
}
indexes.cached = cached

module.exports = indexes
