var assert = require('assert')
var indexNet = require('../lib/')
var cli = require('../bin/cli.js')

describe('indexNet', () => {

  describe('#common', () => {
    describe('#createHome()', () => {
      it('should return promise', () => {
        return indexNet.common.createHome()
      })
    })
  })

  describe('#models', () => {

    var models = indexNet.models

    describe('#history()', () => {
      var history = models.history

      before('rreduce indexes.cached.length', () => {
        var remained = ['000001', '000002', 'DYCB10']
        models.indexes.cached = models.indexes.cached
        .filter((index) => ~remained.indexOf(index.ticker))
      })
      it('should return data for training', () => {
        return history({beginDate: '20160101'})
        .then((past) => {
          assert(past instanceof Array)
          past.forEach((training) => {
            assert(training.input.length)
            assert(training.output.length)
          })
        })
      })

      describe('#*chunk()', () => {
        var samples = 5
        it(`should yield ${samples} samples`, (done) => {
          var generator = history.chunk(1, samples)
          function recurselyNext(current) {
            current.value.then((data) => {
              next = generator.next()
              if (next.done) {
                return done()
              }
              assert.equal(data.length, samples)
              process.nextTick(() => recurselyNext(next))
            })
            .catch(done)
          }
          recurselyNext(generator.next())
        })
      })
    })

    describe('#latest()', () => {
      var latest = models.latest
      it('should return data for activation', () => {
        return latest()
        .then((future) => {
          assert(future instanceof Array)
          future.forEach((value) => {
            assert.notStrictEqual(value)
            assert(0 <= value && value <= 1)
          })
        })
      })
    })

  })

  describe('cli', () => {
    it('should be able to run', () => {
      return cli.run({loopLimit: 2, pathSave: '/dev/null'})
    })
  })

})
