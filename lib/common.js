var fetch = require('node-fetch')
var qs = require('querystring')
var log = require('debug')('index-net:common')
var Hasher = require('./hasher.js')

// const
var DAY = 24 * 3600 * 1000
var pathSave = undefined !== process.env.INDEX_NET_PATH_SAVE
  ? process.env.INDEX_NET_PATH_SAVE
  : `${process.env.HOME}/.index-net.json`

function fetchAPI(api, query) {
  var search = qs.stringify(query)
  return fetch(`${fetchAPI.root}${api}?${search}`, {headers: fetchAPI.headers})
  .then((res) => res.json())
}
fetchAPI.root = 'https://api.wmcloud.com/data/v1'
fetchAPI.headers = { Authorization: `Bearer ${process.env.WMCLOUD_TOKEN}` }

function getRanges(rows, map) {
  var lefts = Object.keys(map)
  var ranges = {}
  for (var i = 0, l = lefts.length; i < l; i++) {
    var left = lefts[i]
    var right = map[left]
    var column = rows.map((row) => row[right])
    .filter(value => undefined !== value)
    var range = {
      max: Math.max(...column),
      min: Math.min(...column)
    }
    range.size = range.max - range.min
    ranges[left] = range
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

var hashers = {}
hashers.input = new Hasher
hashers.output = new Hasher

module.exports = {
  DAY,
  pathSave,
  fetchAPI,
  isBusinessTime,
  getRanges,
  hashers
}
