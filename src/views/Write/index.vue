<!--
 * @Date         : 2022-03-30 10:46:50
 * @Description  :
 * @Autor        : Qzr(z5021996@vip.qq.com)
 * @LastEditors  : Qzr(z5021996@vip.qq.com)
 * @LastEditTime : 2022-04-01 15:44:21
-->

<template>
  <div>
    <!-- webkitdirectory input文件夹属性 -->
    <input type="file"
           webkitdirectory
           @change="fileChangeHandle">
    <el-button @click="uploadHandle">上传</el-button>
    <el-button @click="cancalUploadHandle(false)">取消全部</el-button>

    <div>
      <div>总耗时：{{ timestamp }}</div>
      <div>上传切片耗时：{{ uploadTimestamp }}</div>
      <div>计算hash耗时：{{ hashTimestamp }}</div>

      <div>当前切片上传并发数：{{ chunkLimitAmount }}</div>
      <div>当前文件上传并发数：{{ uploadPool.length }}</div>

      <div>总大小：{{ (totalSize / 1024 / 1024).toFixed(2) }}M</div>

      <div>总分片数：{{ totalChunk }}</div>
      <div>已完成分片数：{{ completedChunk }}</div>

      <div>总文件数：{{ totalFile }}</div>
      <div>完成文件数：{{ completedFile }}</div>
      <div>失败文件数：{{ failFile }}</div>

      <div>
        hash计算进度：
        <el-progress
          :text-inside="true"
          :stroke-width="16"
          :percentage="totalFile ? Math.floor(completedHash / totalFile * 100) : 0" />
      </div>
      <div>
        上传分片进度：
        <el-progress
          :text-inside="true"
          :stroke-width="16"
          :percentage="totalChunk ? Math.floor(completedChunk/totalChunk*100) : 0" />
      </div>
      <div>实时速度：{{ speed }}M/s</div>
      <div>平均上传速度：{{ averageSpeed }}M/s</div>
      <div>
        当前计算hash中：
        <div v-for="(item, index) of calcHashing"
             :key="index">
          {{ item }}
        </div>
      </div>
    </div>

    <div class="file-box">
      <el-card v-for="(item, index) of fileChunkList"
               :key="index"
               class="box-card">
        <template #header>
          <div class="card-header">
            <span>{{ item.name }}</span>
          </div>
          <el-button v-if="!item?.cancel"
                     @click="cancalUploadHandle(item)">取消</el-button>
          <el-button v-if="item?.cancel"
                     @click="uploadOne(item)">恢复</el-button>
        </template>
        <div>
          分片数量：{{ item.chunks }}
        </div>
        <div>
          文件大小：{{ (item.size / 1024 / 1024).toFixed(2) }}M
        </div>
        <div>
          当前状态：{{ checkState(item) }}
        </div>
        <div>
          <!-- 生成hash进度：{{ item.hashPercentage }}% -->
          生成hash进度：
          <el-progress
            :text-inside="true"
            :stroke-width="16"
            status="warning"
            :percentage="item.hashPercentage" />
        </div>
        <div>
          <!-- 上传进度：{{ Math.floor(item.completed / item.chunks * 100) }}% -->
          上传进度：
          <el-progress
            :text-inside="true"
            :stroke-width="16"
            status="success"
            :percentage="Math.floor(item.completed / item.chunks * 100)" />
        </div>
        <div v-for="(chunk, idx) in item.chunkList"
             :key="idx"
             class="text item">分块{{ chunk.chunk }}
          <el-progress
            :text-inside="true"
            :stroke-width="16"
            :percentage="chunk.progress" />
        </div>
      </el-card>
    </div>


  </div>
</template>

<script lang='ts' setup>
import { Ref } from 'vue'
import { axiosFn } from '@/api/axios'
import api from '@/api'
import AXIOS from 'axios'

const CHUNKSIZE = 1024 * 1024 * 5 // 分片大小
const UPLOADLIMIT = 5 // 上传文件并发数
const CHUNKLIMIT = 2  // 分片并发数
const HASHLIMIT = 5 // 计算hash并发数

let fileList:any = ref([])  // 原始文件列表
let fileChunkList:any = ref([]) // 处理后文件列表

let chunkLimitAmount = ref(0) // 当前切片上传并发数

let totalSize = ref(0)
let totalChunk = ref(0) // 总分片数
let totalFile = ref(0)  // 总文件数

let completedChunk = ref(0) // 已上传完的分片数
let completedHash = ref(0) // 已计算完的hash文件
let calcHashing:Ref<string[]> = ref([]) // hash计算中的文件
let caclHashFlag = ref(false) // 全部hash计算完毕标志

let chunkQueue:any = ref([])  // hash计算完毕队列
let uploadPool:any = ref([])  // hash计算完毕 上传池


let completedFile = ref(0)  // 已完毕文件数
let failFile = ref(0) // 失败文件数
let successFile = ref(0)  // 成功文件数

let speedObj:any = reactive({}) // 记录有速度的分片
let lastSpeed:any = 0

let timestamp:any = ref(0)
let uploadTimestamp:any = ref(0)
let hashTimestamp:any = ref(0)

let startTime = 0
let uploadChunkStartTime = 0

let timestampInterval
let uploadChunkInterval
let hashInterval

let uploadLimitInstance
let hashLimitInstance
let cancelPool:any = {}

let cancalObj = {}

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
function fileChangeHandle(e) {
  fileList.value = Array.from(e.target.files)
  if (fileList.value.length < 1) return
  totalFile.value = fileList.value.length
  fileChunkList.value = fileList.value.map(item => {
    const { size, type, lastModifiedDate, name } = item
    const chunks = Math.ceil(size / CHUNKSIZE)
    // 埋点统计
    totalChunk.value += chunks
    totalSize.value += size
    return {
      chunkList: createChunkList(item),
      size,
      type,
      lastModifiedDate,
      name,
      chunks, // 总分片数
      completed: 0, // 已完成分片
      hashPercentage: 0, // hash计算进度
      merge: -1
    }
  })
}

/**
 * 生成分片方法
 * @param file 需分片的文件
 */
function createChunkList(file) {
  const chunkList:any = []
  const { size } = file

  let cur = 0
  let index = 1
  while (cur < size) {
    chunkList.push({
      file: file.slice(cur, cur + CHUNKSIZE),
      chunk: index,
    })
    cur += CHUNKSIZE
    index++
  }
  return chunkList
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


  // 计算hash
  hashLimitInstance = new Limit(HASHLIMIT, (file) => {
    return new Promise((resolve, reject) => {
      calcHash(file).then(hash => {
        chunkQueue.value.push(file)
        completedHash.value++
        setUpload()
        resolve(hash)
      })
    })
  })

  await hashLimitInstance.start(toRaw(fileChunkList.value))
  caclHashFlag.value = true
  hashTimestamp.value = (new Date().getTime() - startTime) / 1000
  clearInterval(hashInterval)

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

  if (completedChunk.value === 0) {
    uploadChunkStartTime = new Date().getTime()
    uploadChunkInterval = setInterval(() => {
      uploadTimestamp.value = uploadTimestamp.value + 1
    }, 1000)
  }

  const { chunkList, hash } = file

  //  TODO: 续传、秒传钩子
  //  chunk isUpload 已上传chunk
  //  文件已上传直接return

  const requestList = chunkList.map(item => {
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

          let speedCount = (Math.floor(lastSize / 1024 / 1024)) / (lastTime / 1000)
          if ((speedCount > 0) && (speedCount < 10000)) {
            speedObj[`${hash}${chunk.chunk}`] = speedCount.toFixed(2)
          }

          const progress = (e.loaded / e.total) * 100
          chunk.progress = progress
        },
        cancelToken: new CancelToken(c => {
          if (!cancalObj[hash]) cancalObj[hash] = []
          cancalObj[hash].push(c)
        })
      }).then(res => {
        file.completed++
        completedChunk.value++
        chunkLimitAmount.value--
        delete speedObj[`${hash}${chunk.chunk}`]

        chunk.isUpload = true // 已上传标识


        if (completedChunk.value === totalChunk.value) {
          console.log('overrrrrrrrrrrrrrrr')
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
 * 取消上传
 * @param file 文件信息
 */
function cancalUploadHandle(file) {
  file.cancel = true
  if (file) {
    cancelPool[file.name]()
    if (file?.hash) cancalItem(file.hash)
    return
  }

  uploadLimitInstance.cancel()
  hashLimitInstance.cancel()
  for (const hash in cancalObj) {
    if (Object.prototype.hasOwnProperty.call(cancalObj, hash)) {
      console.log(hash, cancalObj)
      cancalItem(hash)
    }
  }

  for (const name in cancelPool) {
    if (Object.prototype.hasOwnProperty.call(cancelPool, name)) {
      const reject = cancelPool[name]
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
  console.log('thissssssss', file.hash)
  if (!file?.hash) {
    await calcHash(file)
  }
  await upload(file)
}

/**
 * 计算hash
 * @param chunkList 分片数组
 */
function calcHash(file) {
  const { chunkList } = file
  return new Promise((resovle, reject) => {
    cancelPool[file.name] = reject
    const work = new Worker('/src/views/Write/script/hash.ts')

    work.postMessage({ chunkList: toRaw(chunkList) })
    calcHashing.value.push(file.name)
    work.addEventListener('message', e => {
      file.hashPercentage = Math.floor(e.data.percentage)
      if (e.data.hash) {
        file.hash = e.data.hash
        calcHashing.value.splice(calcHashing.value.indexOf(file.name), 1)
        resovle(e.data.hash)
      }
    })
  })
}

/**
 * 并发promise控制器
 * @param max 最大并发数
 * @param cb 发送请求
 */
class Limit {
  max: number
  cb: any
  pool: any[]
  pathList: string[]
  resolve: any
  reject: any
  constructor(max:number, cb:any) {
    this.pool = []
    this.max = max
    this.cb = cb
    this.pathList = []
  }

  /**
 * 开始
 * @param path 请求路径
 */
  start(path:any[]) {
    return new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
      this.pathList = [...path]
      while ((this.pool.length < this.max) && (this.pathList.length > 0)) {
        this._setTask(this.pathList.shift())
      }
      const race = Promise.race(this.pool)
      this._run(race)
    })
  }

  cancel() {
    this.pool.length = 0
    this.pathList.length = 0
    this.reject()
  }

  private _run(race:any) {
    race.then(() => {
      const path = this.pathList.shift()
      this._setTask(path)
      this._run(Promise.race(this.pool))
    })
  }

  private _setTask(path:string | undefined) {
    if (!path) return
    const promise = this.cb(path)
    this.pool.push(promise)

    promise.then(() => {
      this.pool.splice(this.pool.indexOf(promise), 1)
      if (this.pool.length === 0) {
        this.resolve()
      }
    })

  }
}

</script>

<style scoped lang='stylus'>
.file-box
  {$flex}
  flex-wrap wrap
  > div
    flex auto
    width 20vw
    margin 10px
</style>
