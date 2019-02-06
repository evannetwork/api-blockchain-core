const CID = require('cids')

module.exports = class Store {
  constructor (dag) {
    this._dag = dag
  }

  static isValidLink (link) {
    try {
      const cid = new CID(link)
      return CID.isCID(cid)
    } catch (e) {
      return false
    }
  }
}
