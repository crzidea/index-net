#!/usr/bin/env node
var indexNet = require('../lib/')
var fs = require('mz/fs')
var log = require('debug')('index-net')
var synaptic = require('synaptic');

var net
var past

var errorNoSaveFound = new Error('No save found')

indexNet.models.history().then((data) => {
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
    net = new synaptic.Architect.LSTM(
      past[0].input.length,
      3, 3, 3,
      past[0].output.length
    );
    return log('no save found');
  }
  throw error
})
.then(() => startTrainingLoop(past))
.catch((error) => log(error.stack))


function startTrainingLoop(past) {
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
    var index = indexNet.models.history.expand(output)
    log(index)
    var explaination = indexNet.models.latest.explain(index)
    log(explaination)
  })
}
