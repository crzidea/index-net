#!/usr/bin/env node
var fetch = require('node-fetch')
var qs = require('querystring')

// const
var day = 24 * 3600 * 1000
var pathSave = `${process.env.HOME}/.index-net.json`

function history() {
  var query = {
    indexID: '000001.ZICN',
    beginDate: process.env.INDEX_NET_HISTORY_BEGIN_DATE,
    ticker: '000001'
  }
  var search = qs.stringify(query)
  return fetchAPI(history.api, search)
  .then((body) => {
    history.store.data = body.data
    return history.normalize(body.data)
  })
}
history.api = '/api/market/getMktIdxd.json'
history.store = {}
history.normalize = (data) => {
  for (var i = 0, l = data.length; i < l; i++) {
    var v = data[i];
    v.date = (new Date(v.tradeDate)).valueOf()
  }
  history.store.ranges = getRanges(
    data,
    {
      date:             'date',
      openIndex:        'openIndex',
      closeIndex:       'closeIndex',
      preOpenIndex:     'openIndex',
      preCloseIndex:    'closeIndex',
      preHighestIndex:  'highestIndex',
      preLowestIndex:   'lowestIndex',
      preTurnoverValue: 'turnoverValue',
      preTurnoverVol:   'turnoverVol'
    }
  )
  var ranges = history.store.ranges
  ranges.date.max = history.nextDate().valueOf()
  ranges.date.size = ranges.date.max - ranges.date.min

  var past = []
  for (var i = 1, l = data.length - 2; i < l; i++) {
    var yesterday = data[i - 1]
    var today     = data[i]
    var tomorrow  = data[i + 1]
    var source = {
      date:             tomorrow.date,
      openIndex:        today.openIndex,
      closeIndex:       today.closeIndex,
      preOpenIndex:     yesterday.openIndex,
      preCloseIndex:    yesterday.closeIndex,
      preHighestIndex:  yesterday.highestIndex,
      preLowestIndex:   yesterday.lowestIndex,
      preTurnoverValue: yesterday.turnoverValue,
      preTurnoverVol:   yesterday.turnoverVol
    }
    var input = history.shrink(source)
    var tomorrowCloseIndex = history
    .shrink({closeIndex: tomorrow.closeIndex})
    .closeIndex
    var output = {tomorrowCloseIndex}
    //var change = tomorrow.closeIndex - today.openIndex
    //var output = {change}
    //var percent = Math.round(change / today.openIndex * 100)
    //var output = {percent}
    //var ratio = change / today.openIndex
    //var abs = Math.abs(ratio)
    //var output = { increase: ratio > 0 }
    //for (var j = 1, stalls = 10; j <= stalls; j++) {
      //var rangeA = (j - 1) / 100
      //var rangeB = j / 100
      //output[rangeB] = (rangeA < abs && abs < rangeB)
    //}
    past.push({input, output})
  }
  return past
}
history.shrink = (source) => {
  var dist = {}
  Object.keys(source).forEach((key) => {
    var range = history.store.ranges[key]
    var ratio = (source[key] - range.min) / range.size
    dist[key] = ratio
  })
  return dist
}
history.expand = (source) => {
  var dist = {}
  var ranges = history.store.ranges
  var tomorrowCloseIndex =
    source.tomorrowCloseIndex * ranges.closeIndex.size +
    ranges.closeIndex.min
  return {tomorrowCloseIndex}
}
history.nextDate = (latest) => {
  var latestDate = new Date(history.latest().date + day)
  var nextDate
  if (5 === latestDate.getDay()) {
    nextDate = latestDate.valueOf() + day * 2 + day
  } else {
    nextDate = latestDate.valueOf() + day
  }
  return nextDate
}
history.latest = () => {
  var data = history.store.data
  return data[data.length - 1]
}

function latest() {
  if (latest.store.normalized &&
      (!isBusinessTime() ||
       !latest.shouldCacheUpdate()
      )
     ) {
    return Promise.resolve(latest.store.normalized)
  }
  var query = {
    securityID: '000001.XSHG'
  }
  var search = qs.stringify(query)
  return fetchAPI(latest.api, search)
  .then((body) => {
    var data = body.data[0]
    latest.store.data = data
    latest.store.normalized = latest.normalize(data)
    return latest
  })
}
latest.api = '/api/market/getTickRTSnapshot.json'
latest.store = {}
latest.cacheInterval = 10 * 60 * 1000 // 10 minutes
latest.shouldCacheUpdate = () => {
  return Date.now() - latest.store.updatedAt > latest.cacheInterval
}
latest.normalize = (latest) => {
  var yesterday = history.latest()
  var source = {
    date:             history.store.ranges.date.max,
    openIndex:        latest.openPrice,
    closeIndex:       latest.lastPrice,
    preOpenIndex:     yesterday.openIndex,
    preCloseIndex:    yesterday.closeIndex,
    preHighestIndex:  yesterday.highestIndex,
    preLowestIndex:   yesterday.lowestIndex,
    preTurnoverValue: yesterday.turnoverValue,
    preTurnoverVol:   yesterday.turnoverVol
  }
  var input = history.shrink(source)

  return input
}
latest.explain = (source) => {
  var currentIndex = latest.store.data.lastPrice
  var increased = (source.tomorrowCloseIndex - currentIndex) / currentIndex
  return {currentIndex, increased}
}

var loaders = {history, latest}

function fetchAPI(api, search) {
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

module.exports = {
  fetchAPI,
  loaders,
  pathSave,
  isBusinessTime
}
