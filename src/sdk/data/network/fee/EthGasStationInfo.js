
import D from '../../../D'

let UPDATE_DURATION = 30 * 60 * 1000
if (D.test.networkRequest) {
  UPDATE_DURATION = 60 * 1000
}

export default class EthGasStationInfo {
  constructor (fee) {
    switch (fee.coinType) {
      case D.coin.main.eth:
      case D.coin.test.ethRinkeby:
        this.coinType = fee.coinType
        break
      default:
        throw D.error.coinNotSupported
    }

    if (!fee.fee) {
      fee.fee = {}
      fee.fee[D.fee.fastest] = 10 * 1000000000
      fee.fee[D.fee.fast] = 4 * 1000000000
      fee.fee[D.fee.normal] = 2 * 1000000000
      fee.fee[D.fee.economic] = 1000000000
    }
    this.fee = D.copy(fee) // santonshi per b

    // noinspection JSIgnoredPromiseFromCall
    this.updateFee()
    setInterval(() => this.updateFee().catch(e => console.warn(e)), UPDATE_DURATION)
  }

  onUpdateFee () {
  }

  getCurrentFee () {
    return Object.assign(this.fee)
  }

  async updateFee () {
    const url = 'https://ethgasstation.info/json/ethgasAPI.json'
    let get = (url) => {
      return new Promise((resolve, reject) => {
        console.debug('get', url)
        let xmlhttp = new XMLHttpRequest()
        xmlhttp.onreadystatechange = () => {
          if (xmlhttp.readyState === 4) {
            if (xmlhttp.status === 200) {
              try {
                resolve(JSON.parse(xmlhttp.responseText))
              } catch (e) {
                console.warn(e)
                reject(D.error.networkProviderError)
              }
            } else if (xmlhttp.status === 500) {
              console.warn(url, xmlhttp.status)
              reject(D.error.networkProviderError)
            } else {
              console.warn(url, xmlhttp.status)
              reject(D.error.networkUnavailable)
            }
          }
        }
        xmlhttp.open('GET', url, true)
        xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
        xmlhttp.send()
      })
    }

    /**
     * response
     *
     * @param response.fastest (unit: 0.1 GWei)
     * @param response.fast
     * @param response.average
     * @param response.safeLow
     */
    let response = await get(url)
    let fee = D.copy(this.fee)
    fee.fee[D.fee.fast] = response.fast * 100000000
    fee.fee[D.fee.normal] = response.average * 100000000
    fee.fee[D.fee.economic] = response.safeLow * 100000000
    console.debug('update fee succeed', 'old fee', this.fee, 'new fee', fee)
    this.fee = D.copy(fee)
    this.onUpdateFee(fee)
  }
}
