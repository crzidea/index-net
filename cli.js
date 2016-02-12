#!/usr/bin/env node
var brain = require('brain')
var indexNet = require('./')
var fs = require('mz/fs')
var log = require('debug')('index-net')
var synaptic = require('synaptic');

var net = new brain.NeuralNetwork();

var errorNoSaveFound = new Error('No save found')
var past
indexNet.models.history().then((data) => {
  past = data
    throw errorNoSaveFound
  try {
    var saved = require(indexNet.pathSave)
    net.fromJSON(saved)
  } catch (e) {
    throw errorNoSaveFound
  }
  log('load from saved');
  return predict()
})
.catch((error) => {
  if (errorNoSaveFound === error) {
    return log('no save found');
  }
  throw error
})
.then(() => startTrainingLoop(past))
.catch((error) => log(error.stack))


function startTrainingLoop(past) {
  net.train(past)
  log(`trained with ${past.length} samples`)

  var tasks = []
  // save
  if (indexNet.pathSave) {
    var content = JSON.stringify(net);
    tasks.push(fs.writeFile(indexNet.pathSave, content))
  }
  tasks.push(predict())

  return Promise.all(tasks).then(() => startTrainingLoop(past))
}

function predict() {
  return indexNet.models.latest()
  .then((future) => {
    var output = net.run(future)
    var index = indexNet.models.history.expand(output)
    log(index)
    var explaination = indexNet.models.latest.explain(index)
    log(explaination)
  })
}
