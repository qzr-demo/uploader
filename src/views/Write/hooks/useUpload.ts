import { axiosFn } from '@/api/axios'
import api from '@/api'
import AXIOS from 'axios'
import utils from '@constq/qzr-utils'
import Limit from '../script/limit'
import zipWorker from '../script/zip?worker'

import useHash from './useHash'
import useZip from './useZip'
import useChunk from './useChunk'
import useRenderTree from './useRenderTree'

export default function (CHUNKSIZE, UPLOADLIMIT, CHUNKLIMIT, HASHLIMIT, ZIPSIZE) {
  let fileList: any = ref([]) // 原始文件列表
  let fileChunkList: any = ref([]) // 处理后文件列表

  let chunkLimitAmount = ref(0) // 当前切片上传并发数

  let totalFile = ref(0) // 总文件数

  let completedChunk = ref(0) // 已上传完的分片数

  let completedFile = ref(0) // 已完毕文件数
  let failFile = ref(0) // 失败文件数
  let successFile = ref(0) // 成功文件数

  let speedObj: any = reactive({}) // 记录有速度的分片
  let lastSpeed: any = 0

  let timestamp: any = ref(0)
  let uploadTimestamp: any = ref(0)

  let startTime = ref(0)
  let uploadChunkStartTime = 0
  let startUploadFlag = false

  let timestampInterval
  let uploadChunkInterval

  let uploadLimitInstance = ref()
  let cancelPool: any = {}

  let cancalObj = {}

  const { uploadPool, hashTimestamp, calcHashing, calcHash, hashLimitInstance, calcHashHandle, completedHash, caclHashFlag } = useHash({
    cancelPool,
    HASHLIMIT,
    fileChunkList,
    upload,
    UPLOADLIMIT,
    startTime
  })
  const { zipPercent, zipNowFile, filterSize, generateZipFile } = useZip({ ZIPSIZE })
  const { createChunk, totalSize, totalChunk } = useChunk({ CHUNKSIZE })
  const { renderTree, fileTree } = useRenderTree()

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

    for (const item of fileList.value) {
      if (item.path) {
        Object.defineProperty(item, 'webkitRelativePath', {
          value: item.path,
          writable: true,
        })
      }
      else {
        item.path = item.webkitRelativePath
      }
    }

    if (fileList.value.length < 1) return
    totalFile.value = fileList.value.length
    console.log('fileeeeeeeeeeee', fileList.value)

    const { useZipList, unZipList } = filterSize(fileList.value)
    // fileChunkList.value = createChunk(toRaw(fileList.value))
    fileChunkList.value = createChunk(unZipList)
    renderTree(fileChunkList.value)

    generateZipFile('test.zip', toRaw(useZipList)).then((zip) => {
      const zipFile = createChunk([zip])
      fileChunkList.value.push(zipFile[0])
      zipFile[0].path = '/'
      renderTree(zipFile)
    })
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

    uploadLimitInstance.value.cancel()
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
    startTime.value = new Date().getTime()
    timestampInterval = setInterval(() => {
      timestamp.value = timestamp.value + 1
    }, 1000)

    await calcHashHandle()
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
    uploadLimitInstance.value = new Limit(CHUNKLIMIT, (chunk) => {
      return new Promise((resolve, reject) => {
        let lastSize = 0
        let lastTime = new Date().getTime()
        chunkLimitAmount.value++

        if (chunk.isUpload) resolve(true)
        console.log('thissssssss', chunk)

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

    await uploadLimitInstance.value.start(requestList)

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
        timestamp.value = (Number(new Date().getTime()) - Number(startTime.value)) / 1000
        clearInterval(timestampInterval)
      }
    }
  }

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
    zipNowFile,
    fileTree
  }
}
