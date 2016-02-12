#!/usr/bin/env node
var brain = require('brain')
var indexNet = require('./')
var fs = require('mz/fs')
var log = require('debug')('index-net')

var net = new brain.NeuralNetwork();
var errorNoSaveFound = new Error('No save found')
var past
indexNet.loaders.history().then((data) => {
  past = data
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
  if (!indexNet.isBusinessTime()) {
    log('it is not business time')
    return Promise.resolve()
  }

  return indexNet.loaders.latest()
  .then((future) => {
    var output = net.run(future)
    var index = indexNet.loaders.history.expand(output)
    log(index)
    var explaination = indexNet.loaders.latest.explain(index)
    log(explaination)
  })
}
