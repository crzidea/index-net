#!/usr/bin/env node
var brain = require('brain')
var indexNet = require('./')
var fs = require('fs')

var net = new brain.NeuralNetwork();

indexNet.fetchData()
.then((data) => {
  try {
    var saved = require(indexNet.pathSave)
    net.fromJSON(saved)
    console.log('load from saved');
    var output = net.run(data.future[0])
    console.log(output)
  } catch (e) {
    console.log('No save found');
  }

  setInterval(() => trainAndSave(data), 0)
})

function trainAndSave(data) {
  console.time('train')
  net.train(data.past)
  console.timeEnd('train')
  var output = net.run(data.future[0])
  console.log(output)
  //console.log(`prediction: ${output.change}`);

  // save
  var content = JSON.stringify(net);
  fs.writeFile(indexNet.pathSave, content)
}
