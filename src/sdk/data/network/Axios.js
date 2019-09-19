import axios from 'axios'
import D from '../../D'

export const SERVER = 'proxy.esecubit.com'

axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded'

export default class Axios {
  constructor () {
    if (Axios.prototype.Instance) {
      return Axios.prototype.Instance
    }
    Axios.prototype.Instance = this
  }

  static async get (url) {
    console.debug('get', url)
    let result = await axios.get(url)
    console.debug('get response', result.request.responseText)
    if (result.status === 200 || result.status === 202) {
      try {
        return JSON.parse(result.request.responseText)
      } catch (e) {
        return {response: result.request.responseText}
      }
    }
  }

  static async post (url, args) {
    console.debug('post', url, args)
    let response = await axios.post(url, args)
    console.debug('post response', response.request.responseText)
    if (response.status === 200 || response.status === 202) {
      try {
        return JSON.parse(response.request.responseText)
      } catch (e) {
        return {response: response.request.responseText}
      }
    }
  }

  static isProxy () {
    return D.network.type === 'proxy'
  }

  static isAuto () {
    return D.network.type === 'auto'
  }

  static isDirect () {
    return D.network.type === 'direct'
  }
}
