import Limit from '../script/limit'

export default function ({ cancelPool, HASHLIMIT, chunkQueue, completedHash, fileChunkList, upload, uploadPool, UPLOADLIMIT }) {
  let calcHashing = ref<string[]>([]) // hash计算中的文件
  let hashLimitInstance = ref()

  /**
   * 计算hash
   * @param chunkList 分片数组
   */
  function calcHash(file) {
    const { chunkList } = file
    return new Promise((resovle, reject) => {
      cancelPool[file.id] = reject
      const work = new Worker('/hash.js')

      work.postMessage({ chunkList: toRaw(chunkList) })
      calcHashing.value.push(file.id)
      work.addEventListener('message', (e) => {
        file.hashPercentage = Math.floor(e.data.percentage)
        if (e.data.hash) {
          file.hash = e.data.hash
          calcHashing.value.splice(calcHashing.value.indexOf(file.id), 1)
          resovle(e.data.hash)
        }
      })
    })
  }

  async function calcHashHandle() {
    // 计算hash
    hashLimitInstance.value = new Limit(HASHLIMIT, (file) => {
      return new Promise((resolve, reject) => {
        calcHash(file).then((hash) => {
          chunkQueue.value.push(file)
          completedHash.value++
          setUpload()
          resolve(hash)
        })
      })
    })

    await hashLimitInstance.value.start(fileChunkList.value.filter((item) => !item.hash))
  }

  // 从完成hash的文件队列 加入上传队列
  function setUpload() {
    if (chunkQueue.value.length === 0) return
    if (uploadPool.value.length >= UPLOADLIMIT) return

    const file = chunkQueue.value.shift()
    const promise = new Promise((resolve, reject) => {
      upload(file).then(() => resolve(true))
    })

    uploadPool.value.push(promise)

    promise.then(() => {
      uploadPool.value.splice(uploadPool.value.indexOf(promise), 1)
      setUpload()
    })
  }

  return { calcHashing, calcHash, hashLimitInstance }
}
