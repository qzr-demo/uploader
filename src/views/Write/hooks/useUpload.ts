import { axiosFn } from '@/api/axios'
import api from '@/api'
import AXIOS from 'axios'
import utils from '@constq/qzr-utils'
import Limit from '../script/limit'
import zipWorker from '../script/zip?worker'
import useHash from './useHash'
import useZip from './useZip'

export default function (CHUNKSIZE, UPLOADLIMIT, CHUNKLIMIT, HASHLIMIT, ZIPSIZE) {
  let fileList: any = ref([]) // 原始文件列表
  let fileChunkList: any = ref([]) // 处理后文件列表

  let chunkLimitAmount = ref(0) // 当前切片上传并发数

  let totalSize = ref(0)
  let totalChunk = ref(0) // 总分片数
  let totalFile = ref(0) // 总文件数

  let completedChunk = ref(0) // 已上传完的分片数
  let completedHash = ref(0) // 已计算完的hash文件
  // let calcHashing = ref<string[]>([]) // hash计算中的文件
  let caclHashFlag = ref(false) // 全部hash计算完毕标志

  let chunkQueue: any = ref([]) // hash计算完毕队列
  let uploadPool: any = ref([]) // hash计算完毕 上传池

  let completedFile = ref(0) // 已完毕文件数
  let failFile = ref(0) // 失败文件数
  let successFile = ref(0) // 成功文件数

  let speedObj: any = reactive({}) // 记录有速度的分片
  let lastSpeed: any = 0

  let timestamp: any = ref(0)
  let uploadTimestamp: any = ref(0)
  let hashTimestamp: any = ref(0)

  let startTime = 0
  let uploadChunkStartTime = 0
  let startUploadFlag = false

  let timestampInterval
  let uploadChunkInterval
  let hashInterval

  let uploadLimitInstance
  // let hashLimitInstance
  let cancelPool: any = {}

  let cancalObj = {}

  const { calcHashing, calcHash, hashLimitInstance } = useHash({
    cancelPool,
    HASHLIMIT,
    chunkQueue,
    completedHash,
    fileChunkList,
    upload,
    uploadPool,
    UPLOADLIMIT
  })
  const { zipPercent, zipNowFile, filterSize, generateZipFile } = useZip({ ZIPSIZE })

  // 实时上传速度
  const speed = computed(() => {
    let speedCount = 0
    for (const key in speedObj) {
      if (Object.prototype.hasOwnProperty.call(speedObj, key)) {
        const item = speedObj[key]
        speedCount += parseInt(item)
      }
    }

    if (speedCount === 0) {
      return lastSpeed
    } else {
      lastSpeed = speedCount.toFixed(2)
      return lastSpeed
    }
  })

  // 平均上传速度
  const averageSpeed = computed(() => {
    const completedSize = completedChunk.value * (CHUNKSIZE / 1024 / 1024)
    const result = Math.floor(completedSize / uploadTimestamp.value)
    return uploadTimestamp.value ? result : 0
  })

  /**
   * 确认文件当前状态
   * @param info 文件信息
   */
  function checkState(info) {
    let { hashPercentage, completed, chunks } = info
    let state = '等待中'
    if (hashPercentage === 100) {
      state = '上传中'
    } else if (hashPercentage === 0) {
      state = '等待中'
    } else {
      state = '计算hash'
    }

    if (completed === chunks) state = '分片上传完毕'

    if (info.merge === 0) {
      state = '合并失败'
    } else if (info.merge === 1) {
      state = '上传成功'
    }
    return state
  }

  /**
   * 加入文件触发函数
   * @param e input change事件对象
   */
  async function fileChangeHandle(e, type) {
    if (type === 0) fileList.value = Array.from(e.target.files)
    if (type === 1) fileList.value = Array.from(e)

    if (fileList.value.length < 1) return
    totalFile.value = fileList.value.length

    const useZipList = filterSize(fileList.value)
    fileChunkList.value = createChunk(toRaw(fileList.value))

    generateZipFile('test.zip', useZipList).then((zip) => {
      const zipFile = createChunk([zip])
      fileChunkList.value.push(zipFile[0])
    })
  }

  /**
   * 处理文件列表添加属性
   * @param files 文件列表
   */
  function createChunk(files) {
    const resultList = files
      .filter((item) => {
        return !item?.useZip
      })
      .map((item) => {
        const { size, type, lastModifiedDate, name } = item
        const chunks = Math.ceil(size / CHUNKSIZE)
        // 埋点统计
        totalChunk.value += chunks
        totalSize.value += size
        return {
          path: item?.path,
          chunkList: createChunkList(item),
          size,
          type,
          lastModifiedDate,
          name,
          chunks, // 总分片数
          completed: 0, // 已完成分片
          hashPercentage: 0, // hash计算进度
          merge: -1,
          id: utils.core.Core.randomString(10)
        }
      })

    console.log(resultList)
    return resultList
  }

  /**
   * 生成分片方法
   * @param file 需分片的文件
   */
  function createChunkList(file) {
    const chunkList: any = []
    const { size } = file

    let cur = 0
    let index = 1
    while (cur < size) {
      chunkList.push({
        file: file.slice(cur, cur + CHUNKSIZE),
        chunk: index
      })
      cur += CHUNKSIZE
      index++
    }
    return chunkList
  }

  /**
   * 取消上传
   * @param file 文件信息
   */
  function cancalUploadHandle(file) {
    file.cancel = true
    if (file) {
      cancelPool[file.id]()
      if (file?.hash) cancalItem(file.hash)
      return
    }

    uploadLimitInstance.cancel()
    hashLimitInstance.value.cancel()
    for (const hash in cancalObj) {
      if (Object.prototype.hasOwnProperty.call(cancalObj, hash)) {
        console.log(hash, cancalObj)
        cancalItem(hash)
      }
    }

    for (const id in cancelPool) {
      if (Object.prototype.hasOwnProperty.call(cancelPool, id)) {
        const reject = cancelPool[id]
        reject()
      }
    }

    function cancalItem(hash) {
      for (const c of cancalObj[hash]) {
        c()
      }
    }
  }

  /**
   * 上传单个文件
   * @param file 文件信息
   */
  async function uploadOne(file) {
    if (!file?.hash) {
      await calcHash(file)
    }
    await upload(file)
  }

  /**
   * 点击上传按钮 开始计算hash
   */
  async function uploadHandle() {
    startTime = new Date().getTime()
    timestampInterval = setInterval(() => {
      timestamp.value = timestamp.value + 1
    }, 1000)

    hashInterval = setInterval(() => {
      hashTimestamp.value = hashTimestamp.value + 1
    }, 1000)

    // // 计算hash
    // hashLimitInstance = new Limit(HASHLIMIT, (file) => {
    //   return new Promise((resolve, reject) => {
    //     calcHash(file).then((hash) => {
    //       chunkQueue.value.push(file)
    //       completedHash.value++
    //       setUpload()
    //       resolve(hash)
    //     })
    //   })
    // })

    // await hashLimitInstance.start(fileChunkList.value.filter((item) => !item.hash))
    caclHashFlag.value = true
    hashTimestamp.value = (new Date().getTime() - startTime) / 1000
    clearInterval(hashInterval)

    // 从完成hash的文件队列 加入上传队列
    // function setUpload() {
    //   if (chunkQueue.value.length === 0) return
    //   if (uploadPool.value.length >= UPLOADLIMIT) return

    //   const file = chunkQueue.value.shift()
    //   const promise = new Promise((resolve, reject) => {
    //     upload(file).then(() => resolve(true))
    //   })

    //   uploadPool.value.push(promise)

    //   promise.then(() => {
    //     uploadPool.value.splice(uploadPool.value.indexOf(promise), 1)
    //     setUpload()
    //   })
    // }
  }

  /**
   * 上传分片
   * @param chunkList 分片数组
   */
  async function upload(file) {
    const axios = axiosFn({
      contentType: 'from'
    })
    const CancelToken = AXIOS.CancelToken

    if (!startUploadFlag) {
      startUploadFlag = true
      uploadChunkStartTime = new Date().getTime()
      uploadChunkInterval = setInterval(() => {
        uploadTimestamp.value = uploadTimestamp.value + 1
      }, 1000)
    }

    const { chunkList, hash } = file

    //  TODO: 续传、秒传钩子
    //  chunk isUpload 已上传chunk
    //  文件已上传直接return
    check(file)

    const requestList = chunkList.map((item) => {
      const formData = new FormData()
      formData.append(`${file.name}^${hash}^${item.chunk}`, item.file)
      formData.append('fileHash', hash)
      formData.append('filename', file.filename)
      formData.append('name', file.name)
      formData.append('size', file.size)
      formData.append('type', file.type)
      formData.append('lastModifiedDate', file.lastModifiedDate)
      formData.append('chunks', file.chunks)
      formData.append('chunk', item.chunk)
      item.formData = formData
      return item
    })

    // 上传分片
    uploadLimitInstance = new Limit(CHUNKLIMIT, (chunk) => {
      return new Promise((resolve, reject) => {
        let lastSize = 0
        let lastTime = new Date().getTime()
        chunkLimitAmount.value++

        if (chunk.isUpload) resolve(true)

        axios({
          url: '/api/upload',
          method: 'post',
          data: chunk.formData,
          onUploadProgress(e) {
            lastSize = e.loaded - lastSize
            lastTime = new Date().getTime() - lastTime

            let speedCount = Math.floor(lastSize / 1024 / 1024) / (lastTime / 1000)
            if (speedCount > 0 && speedCount < 10000) {
              speedObj[`${hash}${chunk.chunk}`] = speedCount.toFixed(2)
            }

            const progress = (e.loaded / e.total) * 100
            chunk.progress = progress
          },
          cancelToken: new CancelToken((c) => {
            if (!cancalObj[hash]) cancalObj[hash] = []
            cancalObj[hash].push(c)
          })
        }).then((res) => {
          file.completed++
          completedChunk.value++
          chunkLimitAmount.value--
          delete speedObj[`${hash}${chunk.chunk}`]

          chunk.isUpload = true // 已上传标识

          if (completedChunk.value === totalChunk.value) {
            clearInterval(uploadChunkInterval)
            uploadTimestamp.value = (new Date().getTime() - uploadChunkStartTime) / 1000
          }
          resolve(res)
        })
      })
    })

    await uploadLimitInstance.start(requestList)

    try {
      const mergeRes = await api.mergeChunks({
        chunkSize: CHUNKSIZE,
        // size: file.size,
        filename: file.name
      })
    } catch (error) {
      failFile.value++
      file.merge = 0
      point()
      return
    }

    file.merge = 1
    successFile.value++
    point()

    function point() {
      completedFile.value++
      if (completedFile.value === totalFile.value) {
        timestamp.value = (Number(new Date().getTime()) - Number(startTime)) / 1000
        clearInterval(timestampInterval)
      }
    }
  }

  /**
   * 计算hash
   * @param chunkList 分片数组
   */
  // function calcHash(file) {
  //   const { chunkList } = file
  //   return new Promise((resovle, reject) => {
  //     cancelPool[file.id] = reject
  //     const work = new Worker('/hash.js')

  //     work.postMessage({ chunkList: toRaw(chunkList) })
  //     calcHashing.value.push(file.id)
  //     work.addEventListener('message', (e) => {
  //       file.hashPercentage = Math.floor(e.data.percentage)
  //       if (e.data.hash) {
  //         file.hash = e.data.hash
  //         calcHashing.value.splice(calcHashing.value.indexOf(file.id), 1)
  //         resovle(e.data.hash)
  //       }
  //     })
  //   })
  // }

  /**
   * 检查是否已上传
   * @param file 文件信息
   */
  async function check(file) {
    const { name, hash } = file
    const res = await api.check({
      hash,
      name
    })

    console.log(res)
  }

  // /**
  //  * 过滤文件大小低于zip标志的文件 添加useZip标识
  //  * @param fileList
  //  * @returns
  //  */
  // function filterSize(fileList) {
  //   for (const item of fileList) {
  //     if (item.size < ZIPSIZE) {
  //       item.useZip = true
  //     }
  //   }

  //   return toRaw(fileList).filter((item) => item.useZip)
  // }

  // /**
  //  * 启用webworker合并计算zip文件
  //  * @param zipName
  //  * @param files
  //  * @param options
  //  * @returns
  //  */
  // function generateZipFile(zipName, files) {
  //   const options: any = { type: 'blob', compression: 'DEFLATE' }
  //   return new Promise((resolve, reject) => {
  //     console.log('thissssssssss', files)
  //     const work = new zipWorker()

  //     work.postMessage({ zipName, fileList: files, options })

  //     work.addEventListener('message', (e) => {
  //       const percentage = e.data.percentage
  //       const nowFile = e.data.nowFile
  //       zipNowFile.value = nowFile
  //       zipPercent.value = percentage
  //       if (e.data.file) {
  //         const file = e.data.file
  //         console.log('thisssssssssssssss', file)
  //         resolve(file)
  //       }
  //     })
  //   })
  // }

  return {
    uploadHandle,
    timestamp,
    uploadTimestamp,
    hashTimestamp,
    chunkLimitAmount,
    uploadPool,
    totalSize,
    totalChunk,
    completedChunk,
    totalFile,
    completedFile,
    failFile,
    completedHash,
    speed,
    averageSpeed,
    calcHashing,
    fileChunkList,
    cancalUploadHandle,
    checkState,
    uploadOne,
    fileChangeHandle,
    zipPercent,
    zipNowFile
  }
}
