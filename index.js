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
    //var data = body.data.reverse()
    history.store = body.data
    return history.normalize(body.data)
  })
}
history.api = '/api/market/getMktIdxd.json'
history.normalize = (history) => {
  var past = []
  for (var i = 1, l = history.length - 2; i < l; i++) {
    var yesterday = history[i - 1]
    var today     = history[i]
    var tormorrow = history[i + 1]
    var date = new Date(tormorrow.tradeDate)
    var input = {
      date:             new Date(tormorrow.tradeDate).valueOf(),
      openIndex:        today.openIndex,
      closeIndex:       today.closeIndex,
      preOpenIndex:     yesterday.openIndex,
      preCloseIndex:    yesterday.closeIndex,
      preHighestIndex:  yesterday.highestIndex,
      preLowestIndex:   yesterday.lowestIndex,
      preTurnoverValue: yesterday.turnoverValue,
      preTurnoverVol:   yesterday.turnoverVol
    }
    //var output = {tomorrowCloseIndex: history[i + 1].closeindex}
    var change = tormorrow.closeIndex - today.openIndex
    //var output = {change}
    //var percent = Math.round(change / today.openIndex * 100)
    //var output = {percent}
    var ratio = change / today.openIndex
    var abs = Math.abs(ratio)
    var output = { increase: ratio > 0 }
    for (var j = 1, stalls = 10; j <= stalls; j++) {
      var rangeA = (j - 1) / 100
      var rangeB = j / 100
      output[rangeB] = (rangeA < abs && abs < rangeB)
    }
    past.push({input, output})
  }
  return past
}
history.store = null

function latest() {
  var query = {
    securityID: '000001.XSHG'
  }
  var search = qs.stringify(query)
  return fetchAPI(latest.api, search)
  .then((body) => {
    //var data = body.data.reverse()
    return latest.normalize(body.data[0])
  })
  .catch((error) => {
    console.log(error);
  })
}
latest.api = '/api/market/getTickRTSnapshot.json'
latest.normalize = (latest) => {
  var latestDate = new Date(latest.dataDate)
  var nextDate
  if (5 === latestDate.getDay()) {
    nextDate = latestDate.valueOf() + day * 2 + day
  } else {
    nextDate = latestDate.valueOf() + day
  }
  var yesterday = history.store[history.store.length - 1]
  var input = {
    date:             nextDate.valueOf(),
    openIndex:        latest.openPrice,
    closeIndex:       latest.lastPrice,
    preOpenIndex:     yesterday.openIndex,
    preCloseIndex:    yesterday.closeIndex,
    preHighestIndex:  yesterday.highestIndex,
    preLowestIndex:   yesterday.lowestIndex,
    preTurnoverValue: yesterday.turnoverValue,
    preTurnoverVol:   yesterday.turnoverVol
  }

  return {input}
}

var loaders = {history, latest}

function fetchAPI(api, search) {
  return fetch(`${fetchAPI.root}${api}?${search}`, {headers: fetchAPI.headers})
  .then((res) => res.json())
}
fetchAPI.root = 'https://api.wmcloud.com/data/v1'
fetchAPI.headers = { Authorization: `Bearer ${process.env.WMCLOUD_TOKEN}` }

module.exports = {
  fetchAPI,
  loaders,
  pathSave
}
