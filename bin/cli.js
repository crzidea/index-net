#!/usr/bin/env node
var bluebird = require('bluebird')
var indexNet = require('../lib/')
var fs = require('mz/fs')
var log = require('debug')('index-net:cli')
var synaptic = require('synaptic');

var net
var loopLimit

var errorNoSaveFound = new Error('No save found')

function run(options) {
  options = options || {}
  loopLimit = options.loopLimit || Infinity
  indexNet.options.pathSave = options.pathSave ||
    `${indexNet.options.home}/save.json`

  return indexNet.common.createHome()
  .then(() => {
    return indexNet.models.history({
      ticker: process.env.INDEX_NET_TICKER,
      beginDate: process.env.INDEX_NET_HISTORY_BEGIN_DATE
    })
  })
  .then((data) => {
    try {
      var saved = require(indexNet.options.pathSave)
      if (!saved.neurons) {
        throw errorNoSaveFound
      }
      net = synaptic.Network.fromJSON(saved)
      net.trainer = new synaptic.Trainer(net)
      log('load from saved');
    } catch (e) {
      throw errorNoSaveFound
    }
    return predict()
  })
  .catch((error) => {
    if (errorNoSaveFound === error) {
      var fields = indexNet.models.history.fields
      var args = [
        indexNet.models.history.store.availableTickers.length,
        fields.today.length + fields.yesterday.length + 1
      ]
      //var args = indexNet.models.history.store.availableTickers
      //.map(() => fields.today.length + fields.yesterday.length + 1)
      args.unshift(indexNet.common.hashers.input.hash.length)
      args.push(indexNet.common.hashers.output.hash.length)
      net = new synaptic.Architect.LSTM(...args);
      return log('no save found');
    }
    throw error
  })
  .then(startTrainingLoop)
}

var loopRan = 0
var chunkStart = 0
function startTrainingLoop() {
  if (loopRan++ >= loopLimit) {
    return
  }

  chunkStart++
  chunkStart %= indexNet.options.chunkSteps
  if (!chunkStart) {
    chunkStart = indexNet.options.chunkSteps
  }

  var history = indexNet.models.history
  var generator = history.chunk(chunkStart, indexNet.options.chunkSteps)
  return bluebird.coroutine(function*() {
    while (true) {
      var next = generator.next()
      if (next.done) {
        return
      }
      var data = yield next.value
      net.trainer.train(data)
      log(`trained with ${data.length} samples`)
    }
  })()
  .then(() => {
    var tasks = []
    // save
    var content = JSON.stringify(net);
    tasks.push(fs.writeFile(indexNet.options.pathSave, content))
    tasks.push(predict())

    return Promise.all(tasks).then(() => startTrainingLoop())
  })
}

function predict() {
  return indexNet.models.latest()
  .then((future) => {
    var output = net.activate(future)
    output = indexNet.common.hashers.output.deserialize(output)
    log(output)
    var ticker = indexNet.models.history.options.ticker
    var field = 'closeIndex'
    var index = indexNet.models.history.expand(
      ticker,
      field,
      output[`${ticker}.tomorrow.${field}`]
    )
    log(`index: ${index}`)
    var explaination = indexNet.models.latest.explain(index)
    log(explaination)
  })
}

if (!module.parent) {
  run().catch((error) => {
    log(error.stack)
    process.exit()
  })
} else {
  exports.run = run
}
