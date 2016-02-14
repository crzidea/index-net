var assert = require('assert')
var indexNet = require('../lib/')
var cli = require('../bin/cli.js')

describe('indexNet', () => {

  describe('#models', () => {

    var models = indexNet.models

    describe('#history()', () => {
      var history = models.history

      //before('rreduce indexes.cached.length', () => {
        //var remained = ['000001', '000002']
        //models.indexes.cached = models.indexes.cached
        //.filter((index) => ~remained.indexOf(index.ticker))
      //})
      it('should return data for training', () => {
        return history({beginDate: '20160101'})
        .then((past) => {
          assert(past instanceof Array)
        })
      })
    })

    describe('#latest()', () => {
      var latest = models.latest
      it('should return data for activation', () => {
        return latest()
        .then((future) => {
          assert(future instanceof Array)
        })
      })
    })

  })

  describe('cli', () => {
    it('should be able to run', () => {
      return cli.run({loopLimit: 2})
    })
  })

})
