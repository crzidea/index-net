function Hasher() {}

Hasher.prototype.serialize = function(object) {
  if (!this.hash) {
    this.hash = Object.keys(object).sort()
  }
  var hash = this.hash
  var array = []
  for (var i = 0, l = hash.length; i < l; i++) {
    var key = hash[i];
    var value = object[key]
    if (isNaN(value)) {
      return
    }
    array.push(value)
  }
  return array
};

Hasher.prototype.deserialize = function(array) {
  var object = {}
  for (var i = 0, l = this.hash.length; i < l; i++) {
    var key = this.hash[i];
    object[key] = array[i]
  }
  return object
}

module.exports = Hasher
