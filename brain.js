#!/usr/bin/env node
var brain = require('brain')
var indexNet = require('./')
var fs = require('fs')

var net = new brain.NeuralNetwork();

indexNet.loaders.history().then((past) => {
  try {
    var saved = require(indexNet.pathSave)
    net.fromJSON(saved)
    console.log('load from saved');
    predict().then(() => {
      indexNet.loaders.history()
      .then(startTrainingLoop)
    })
  } catch (e) {
    console.log('No save found');
    startTrainingLoop(past)
  }
})


function startTrainingLoop(past) {
  console.time('train')
  net.train(past)
  console.timeEnd('train')
  predict().then(() => startTrainingLoop(past))

  // save
  var content = JSON.stringify(net);
  fs.writeFile(indexNet.pathSave, content)
}

function predict() {
  return indexNet.loaders.latest()
  .then((future) => {
    var output = net.run(future)
    console.log(output)
  })
}
