#!/usr/bin/env node
var fetch = require('node-fetch')
var convnetjs = require('convnetjs')
var qs = require('querystring')
var fs = require('fs')


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

var pathSave = `${process.env.HOME}/.index-net-${query.indexID}.json`

fetch(`${urls.root}${urls.api}?${search}`, { headers })
.then((res) => {
  return res.json()
})
.then((body) => {
  var data = body.data.reverse()

  var options = everyDay(data)

  var opts = {}; // options struct
  //opts.train_ratio = 0.7;
  opts.num_folds = 30; // number of folds to eval per candidate
  opts.num_candidates = 3; // number of candidates to eval in parallel
  opts.num_epochs = 90; // epochs to make through data per fold
  // below, train_data is a list of input Vols and train_labels is a
  // list of integer correct labels (in 0...K).

  var magicNet = new convnetjs.MagicNet(options.trainData, options.trainLabels, opts)
  //var magicNet = new convnetjs.MagicNet(options.trainData, options.trainLabels)
  try {
    var saved = require(pathSave)
    magicNet.fromJSON(saved);
    var label = magicNet.predict(options.finalVol)
    console.log(`predict label from saved: ${label}`);
  } catch (e) {
    console.log('No save found')
  }

  console.time('batch')
  magicNet.onFinishBatch(() => {
    save()
    var label = magicNet.predict(options.finalVol)
    console.log(`label: ${label}`);
    console.timeEnd('batch')
  })

  function save() {
    var content = JSON.stringify(magicNet)
    fs.writeFile(pathSave, content)
  }

  var steps = 0
  //console.time('step');
  setInterval(() => {
    //console.log(`steps: ${steps++}`);
    //console.timeEnd('step');
    magicNet.step()
  }, 0)
})
.catch((error) => {
  console.error(error.stack);
});

function everyMonth(data) {
  var dimensions = 30 - 4 * 2 // data of a month

  var trainData = []
  var trainLabels = []
  for (var i = dimensions + 1, l = data.length; i < l; i++) {
    var point = []
    for (var j = i - dimensions - 1, l2 = i - 1; j < l2; j++) {
      point.push(data[j].closeindex)
    }
    var vol = new convnetjs.Vol(point)
    trainData.push(vol)
    var label = data[i].closeindex
    trainLabels.push(label)
  }

  var finalPoint = []
  for (var i = data.length - dimensions - 1, l = data.length; i < l; i++) {
    finalPoint.push(data[i].closeindex)
  }
  var finalVol = new convnetjs.Vol(finalPoint)

  return {trainData, trainLabels, finalVol}
}

function everyDay(data) {
  var day = 24 * 3600 * 1000

  var firstData = data[0]
  var firstDate = new Date(firstData.tradeDate)
  var lastData = data[data.length - 1]
  var lastDate = new Date(lastData.tradeDate)
  var days = (lastDate - firstDate) / day
  var increment = (lastData.closeindex - firstData.closeindex) / days

  var trainData = []
  var trainLabels = []
  for (var i = 0, l = data.length - 2; i < l; i++) {
    var date = new Date(data[i].tradeDate);
    var indexDay = (date - firstDate) / day
    var expectIndex = firstData.closeindex + increment * indexDay
    var vol = new convnetjs.Vol([
      data[i].preClosePrice,
      data[i].openIndex,
      expectIndex
    ])
    trainData.push(vol)
    var change = data[i + 1].closeindex - data[i].openIndex
    var percent = Math.round(change / data[i].openIndex * 100)
    trainLabels.push(percent)
  }

  var latestData = data[data.length - 1]
  var latestDate = new Date(latestData.tradeDate)
  var finalDayValue
  if (5 === latestDate.getDay()) {
    finalDayValue = latestDate.valueOf() + day * 2 + day
  } else {
    finalDayValue = latestDate.valueOf() + day
  }
  var indexDay = (finalDayValue - firstDate) / day
  var expectIndex = firstData.closeindex + increment * indexDay
  var finalVol = new convnetjs.Vol([
    latestData.preClosePrice,
    latestData.openIndex,
    expectIndex
  ])

  return {trainData, trainLabels, finalVol}
}