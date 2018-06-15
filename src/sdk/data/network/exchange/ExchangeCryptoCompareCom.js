
import D from '../../../D'

let UPDATE_DURATION = 10 * 60 * 1000
if (D.test.networkRequest) {
  UPDATE_DURATION = 60 * 1000
}

const UNITS = {}
UNITS[D.coin.main.btc] = D.unit.btc.BTC
UNITS[D.coin.test.btcTestNet3] = D.unit.btc.BTC
UNITS[D.coin.main.eth] = D.unit.eth.Ether
UNITS[D.coin.test.ethRinkeby] = D.unit.eth.Ether

const REQUEST_COINS = {}
REQUEST_COINS[D.coin.main.btc] = 'BTC'
REQUEST_COINS[D.coin.test.btcTestNet3] = 'BTC'
REQUEST_COINS[D.coin.main.eth] = 'ETH'
REQUEST_COINS[D.coin.test.ethRinkeby] = 'ETH'

export default class ExchangeCryptoCompareCom {
  constructor (exchange) {
    switch (exchange.coinType) {
      case D.coin.main.btc:
      case D.coin.test.btcTestNet3:
      case D.coin.main.eth:
      case D.coin.test.ethRinkeby:
        this.coinType = exchange.coinType
        break
      default:
        throw D.error.coinNotSupported
    }

    this.exchange = D.copy(exchange)
    this.exchange.unit = UNITS[exchange.coinType]
    this.exchange.exchange = exchange.exchange ||
      D.suppertedLegals().reduce((obj, currency) => (obj[currency] = 0) || obj, {})
    this.requestCoin = REQUEST_COINS[exchange.coinType]

    // noinspection JSIgnoredPromiseFromCall
    this.updateExchange()
    setInterval(() => this.updateExchange().catch(e => console.warn(e)), UPDATE_DURATION)
  }

  onUpdateExchange () {
  }

  getCurrentExchange () {
    return D.copy(this.exchange)
  }

  async updateExchange () {
    const url = 'https://min-api.cryptocompare.com/data/price?fsym=' + this.requestCoin + '&tsyms=USD,JPY,EUR,legal.CNY'
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
     *{
     * "USD": float,
     * "JPY": float,
     * "EUR": float,
     * "legal.CNY": float,
     *}
     */
    let response = await get(url)
    let exchange = D.copy(this.exchange)
    exchange.exchange = response
    console.debug('update exchange succeed', 'old exchange', this.exchange, 'new exchange', exchange)
    this.exchange = D.copy(exchange)
    this.onUpdateExchange(exchange)
  }
}
