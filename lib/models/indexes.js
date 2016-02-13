var log = require('debug')('index-net:models:indexes')
var common = require('../common.js')

function latest() {
  return common.fetchAPI(latest.api)
  .then((body) => {
    return body.data
  })
}
latest.api = '/api/idx/getIdx.json'

module.exports = latest
