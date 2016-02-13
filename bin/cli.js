#!/usr/bin/env node
var indexNet = require('../lib/')
var fs = require('mz/fs')
var log = require('debug')('index-net:cli')
var synaptic = require('synaptic');

var net
var past
var loopLimit

var errorNoSaveFound = new Error('No save found')

function run(options) {
  options = options || {}
  loopLimit = options.loopLimit || Infinity

  return indexNet.models.history({
    ticker: process.env.INDEX_NET_TICKER,
    beginDate: process.env.INDEX_NET_HISTORY_BEGIN_DATE
  })
  .then((data) => {
    past = data
    try {
      var saved = require(indexNet.common.pathSave)
      net = synaptic.Network.fromJSON(saved)
      net.trainer = new synaptic.Trainer(net)
    } catch (e) {
      throw errorNoSaveFound
    }
    log('load from saved');
    return predict()
  })
  .catch((error) => {
    if (errorNoSaveFound === error) {
      var args = indexNet.models.history.store.availableTickers
      .map(() => 3)
      args.unshift(past[0].input.length)
      args.push(past[0].output.length)
      net = new synaptic.Architect.LSTM(...args);
      return log('no save found');
    }
    throw error
  })
  .then(() => startTrainingLoop(past))
}

var loopRan = 0
function startTrainingLoop(past) {
  if (loopRan++ > loopLimit) {
    return
  }

  net.trainer.train(past)
  log(`trained with ${past.length} samples`)

  var tasks = []
  // save
  if (indexNet.common.pathSave) {
    var content = JSON.stringify(net);
    tasks.push(fs.writeFile(indexNet.common.pathSave, content))
  }
  tasks.push(predict())

  return Promise.all(tasks).then(() => startTrainingLoop(past))
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
  run().catch((error) => log(error.stack))
} else {
  exports.run = run
}
