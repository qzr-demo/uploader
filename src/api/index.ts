import { axiosDefault } from './axios'
const axios = axiosDefault

export default {
  mergeChunks(param) {
    return axios.post('/api/mergeChunks', param)
  }
}
