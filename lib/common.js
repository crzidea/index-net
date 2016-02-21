var bluebird = require('bluebird')
global.Promise = bluebird
var qs = require('querystring')
var log = require('debug')('index-net:common')
var Hasher = require('./hasher.js')
var Agent = require('https').Agent
var fetch = require('node-fetch')
var mkdirp = bluebird.promisify(require('mkdirp'))
var options = require('./options.js')

// const
var DAY = 24 * 3600 * 1000

function fetchAPI(api, query) {
  var search = qs.stringify(query)
  return fetch(
    `${fetchAPI.root}${api}?${search}`,
    {
      headers: fetchAPI.headers,
      agent: fetchAPI.agent
    }
  )
  .then((res) => res.json())
  .catch((error) => {
    log(error.stack)
    log(`retry fetch api ${api}`)
    return fetchAPI(api, query)
  })
}
fetchAPI.root = 'https://api.wmcloud.com/data/v1'
fetchAPI.headers = { Authorization: `Bearer ${process.env.WMCLOUD_TOKEN}` }
fetchAPI.agent = new Agent({keepAlive: true, maxSockets: 256})

function ranges(rows, fields) {
  var ranges = {}
  for (var i = 0, l = fields.length; i < l; i++) {
    var field = fields[i]
    var column = rows.map((row) => row[field] || 0)
    //.filter(value => undefined !== value)
    var range = {
      max: Math.max(...column),
      min: Math.min(...column)
    }
    range.size = range.max - range.min
    ranges[field] = range
  }
  return ranges
}

function isBusinessTime() {
  var now = new Date
  var day = now.getDay()
  var hours = now.getHours()
  if (1 <= day && day <= 5 &&
      10 <= hours && hours <= 15) {
    return true
  }
  return false
}

function shouldCacheUpdate(model) {
  if (!model.store.updatedAt) {
    return true
  }
  return Date.now() - model.store.updatedAt > model.cacheInterval
}

var hashers = {}
hashers.input = new Hasher
hashers.output = new Hasher

function createHome() {
  log(`create home at ${options.home}`)
  return mkdirp(options.home)
}

module.exports = {
  DAY,
  fetchAPI,
  isBusinessTime,
  ranges,
  shouldCacheUpdate,
  hashers,
  createHome
}
