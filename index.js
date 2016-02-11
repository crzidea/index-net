#!/usr/bin/env node
var fetch = require('node-fetch')
var qs = require('querystring')

var urls = {}
urls.root = 'https://api.wmcloud.com/data/v1'
//urls.api = '/api/market/getMktIdxdJY.json'
urls.api = '/api/idx/getMktEquIdxdCCXE.json'
//urls.api = '/api/market/getMktMonthJY.json'

var query = {
  //secID: '000001.XSHG',
  indexID: '000001.ZICN',
  //startDate: '19700101',
  //endDate: '20160101'
}
var search = qs.stringify(query)

var headers = { Authorization: `Bearer ${process.env.WMCLOUD_TOKEN}` }

exports.pathSave = `${process.env.HOME}/.index-net-${query.indexID}.json`

function fetchData() {
  return fetch(`${urls.root}${urls.api}?${search}`, { headers })
  .then((res) => {
    return res.json()
  })
  .then((body) => {
    var data = body.data.reverse()
    return normalize(data)
  })
  .catch((error) => {
    console.error(error.stack);
  })
}

var day = 24 * 3600 * 1000

function normalize(data) {
  var past = []
  for (var i = 0, l = data.length - 2; i < l; i++) {
    var date = new Date(data[i].tradeDate);
    var input = {
      date: date.valueOf(),
      preClosePrice: data[i].preClosePrice,
      openIndex: data[i].openIndex,
    }
    //var output = {tomorrowCloseIndex: data[i + 1].closeindex}
    var change = data[i + 1].closeindex - data[i].openIndex
    //var output = {change}
    //var percent = Math.round(change / data[i].openIndex * 100)
    //var output = {percent}
    var radio = change / data[i].openIndex
    var abs = Math.abs(radio)
    var output = { increase: radio > 0 ? 1 : 0 }
    for (var j = 1, stalls = 10; j <= stalls; j++) {
      var rangeA = (j - 1) / 100
      var rangeB = j / 100
      output[rangeB] = (rangeA < abs && abs < rangeB) ? 1: 0
    }
    past.push({input, output})
  }

  var future = []
  var input = {}
  var latestData = data[data.length - 1]
  var latestDate = new Date(latestData.tradeDate)
  if (5 === latestDate.getDay()) {
    input.date = latestDate.valueOf() + day * 2 + day
  } else {
    input.date = latestDate.valueOf() + day
  }
  input.preClosePrice = latestData.preClosePrice
  input.openIndex = latestData.openIndex
  future.push({input})

  return {past, future}
}

exports.fetchData = fetchData
