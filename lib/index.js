var common = require('./common.js')
var models = {
  history: require('./models/history.js'),
  latest: require('./models/latest.js')
}

module.exports = {
  common,
  models,
}
