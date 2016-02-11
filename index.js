#!/usr/bin/env node
var fetch = require('node-fetch')
var qs = require('querystring')

var urls = {}
urls.root = 'https://api.wmcloud.com/data/v1'
//urls.api = '/api/market/getMktIdxdJY.json'
//urls.api = '/api/idx/getMktEquIdxdCCXE.json'
//urls.api = '/api/market/getMktMonthJY.json'
urls.apiHistory = '/api/market/getMktIdxd.json'
urls.apiLatest = '/api/market/getTickRTSnapshot.json'

var queryHistory = {
  indexID: '000001.ZICN',
  //startDate: '19700101',
  //endDate: '20160101'
  ticker: '000001'
}
var searchHistory = qs.stringify(queryHistory)

var queryLatest = {
  securityID: '000001.XSHG'
}
var searchLatest = qs.stringify(queryLatest)

var headers = { Authorization: `Bearer ${process.env.WMCLOUD_TOKEN}` }

exports.pathSave = `${process.env.HOME}/.index-net-${queryHistory.indexID}.json`

function fetchData() {
  return Promise.all([
    fetchAPI(urls.apiHistory, searchHistory),
    fetchAPI(urls.apiLatest, searchLatest),
  ])
  .then((bodies) => {
    //var data = body.data.reverse()
    return normalize(bodies[0].data, bodies[1].data[0])
  })
  .catch((error) => {
    console.error(error.stack);
  })
}

function fetchAPI(api, search) {
  return fetch(`${urls.root}${api}?${search}`, { headers })
  .then((res) => res.json())
}

var day = 24 * 3600 * 1000

function normalize(history, latest) {
  var past = []
  for (var i = 1, l = history.length - 2; i < l; i++) {
    var date = new Date(history[i + 1].tradeDate)
    var input = {
      date: date.valueOf(),
      openIndex: history[i].openIndex,
      closeIndex: history[i].closeIndex,
      preOpenIndex: history[i - 1].openIndex,
      preCloseIndex: history[i - 1].closeIndex,
      preHighestIndex: history[i - 1].highestIndex,
      preLowestIndex: history[i - 1].lowestIndex,
      preTurnoverValue: history[i - 1].turnoverValue,
      preTurnoverVol: history[i - 1].turnoverVol
    }
    //var output = {tomorrowCloseIndex: history[i + 1].closeindex}
    var change = history[i + 1].closeIndex - history[i].openIndex
    //var output = {change}
    //var percent = Math.round(change / history[i].openIndex * 100)
    //var output = {percent}
    var ratio = change / history[i].openIndex
    var abs = Math.abs(ratio)
    var output = { increase: ratio > 0 ? 1 : 0 }
    for (var j = 1, stalls = 10; j <= stalls; j++) {
      var rangeA = (j - 1) / 100
      var rangeB = j / 100
      output[rangeB] = (rangeA < abs && abs < rangeB) ? 1: 0
    }
    past.push({input, output})
  }

  var future = []
  var latestDate = new Date(latest.dataDate)
  var date
  if (5 === latestDate.getDay()) {
    date = latestDate.valueOf() + day * 2 + day
  } else {
    date = latestDate.valueOf() + day
  }
  var lastHistory = history[history.length - 1]
  var input = {
    date: date.valueOf(),
    openIndex: latest.openPrice,
    closeIndex: latest.lastPrice,
    preOpenIndex: lastHistory.openIndex,
    preCloseIndex: lastHistory.closeIndex,
    preHighestIndex: lastHistory.highestIndex,
    preLowestIndex: lastHistory.lowestIndex,
    preTurnoverValue: lastHistory.turnoverValue,
    preTurnoverVol: lastHistory.turnoverVol
  }
  future.push({input})

  return {past, future}
}

exports.fetchData = fetchData
