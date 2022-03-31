<!--
 * @Date         : 2022-03-30 10:46:50
 * @Description  :
 * @Autor        : Qzr(z5021996@vip.qq.com)
 * @LastEditors  : Qzr(z5021996@vip.qq.com)
 * @LastEditTime : 2022-03-31 10:58:37
-->

<template>
  <div>
    <!-- webkitdirectory input文件夹属性 -->
    <input type="file"
           webkitdirectory
           @change="handleFileChange">
    <el-button @click="handleUpload">上传</el-button>

    <div>
      <div>当前并发数：{{limitAmount}}</div>
      <div>总大小：{{ totalSize }}</div>
      <div>总进度:{{ totalSize }}</div>
      <div>实时速度：</div>
    </div>

    <div v-for="(item, index) of fileChunkList"
         :key="index">
      <div>
        {{ item.name }}
      </div>
      <div>
        分片数量：{{item.chunks}}
      </div>
      <div>
        当前状态：{{checkState(item)}}
        <!-- 当前状态：{{item.hashPercentage !== 100 ? '计算hash' : '上传中'}} -->
      </div>
      <div>
        生成hash进度：{{ item.hashPercentage }}%
      </div>
      <div>
        上传进度：{{Math.floor(item.completed / item.chunks * 100)}}%
      </div>
    </div>
  </div>
</template>

<script lang='ts' setup>
import { ref } from 'vue'
import { axiosFn } from '@/api/axios'
import api from '@/api'

const SIZE = 1024 * 1024 * 5
let fileList:any = ref([])
let fileChunkList:any = ref([])
let limitAmount = ref(0)
let totalSize = ref(0)
let timestamp = 0
let md5stamp = 0

function checkState(info) {
  let {hashPercentage, completed, chunks} = info
  let state = '等待中'
  if(hashPercentage === 100) {
    state = '上传中'
  }else if(hashPercentage === 0) {
    state = '等待中'
  }else {
    state = '计算hash'
  }

  if(completed === chunks) state = '分片上传完毕'
  return state
}

/**
 * 加入文件触发函数
 * @param e input change事件对象
 */
function handleFileChange(e) {
  fileList.value = Array.from(e.target.files)
  if (fileList.value.length < 1) return
  fileChunkList.value = fileList.value.map(item => {
    const { size, type, lastModifiedDate, name } = item
    const chunks = Math.ceil(size / SIZE)
    totalSize.value += size
    return {
      chunkList: createChunkList(item),
      size,
      type,
      lastModifiedDate,
      name,
      chunks,
      completed: 0,
      hashPercentage: 0
    }
  })
}

/**
 * 生成分片方法
 * @param file 需分片的文件
 */
function createChunkList(file) {
  const chunkList:any = []
  console.log(file)
  const { size } = file

  let cur = 0
  let index = 1
  while (cur < size) {
    chunkList.push({
      file: file.slice(cur, cur + SIZE),
      chunk: index,
    })
    cur += SIZE
    index++
  }
  return chunkList
}

/**
 * 点击上传按钮 上传分片方法
 */
async function handleUpload() {
  for (const item of fileChunkList.value) {
    await upload(item)
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

  const { chunkList } = file

  console.log(file)
  const hash:any = await calcHash(chunkList, file)

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
    // return axios.post('/api/upload', formData)
    return formData
  })

  // const request = await Promise.all(requestList)
  const limit = new Limit(3, (form) => {
    return new Promise((resolve, reject) => {
      axios.post('/api/upload', form).then(res => {
        file.completed ++
        resolve(res)
      })
    })
  })

  const request = await limit.start(requestList)
  // const request = await Promise.all(requestList)
  console.log(requestList, request)
  const mergeRes = await api.mergeChunks({
    size: file.size,
    filename: file.name
  })
  console.log(mergeRes)
}

/**
 * 计算hash
 * @param chunkList 分片数组
 */
function calcHash(chunkList, file) {
  return new Promise((resovle, reject) => {
    const work = new Worker('/src/views/Write/script/hash.js')

    console.log(file)
    work.postMessage({ chunkList: toRaw(chunkList) })
    work.addEventListener('message', e => {
      file.hashPercentage = Math.floor(e.data.percentage)
      if (e.data.hash) resovle(e.data.hash)
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
      this.pathList = [...path]
      while (this.pool.length < this.max) {
        this._setTask(this.pathList.shift())
      }
      const race = Promise.race(this.pool)
      this._run(race)
    })
  }

  private _run(race:any) {
    race.then(() => {
      if(this.pathList.length === 0) {
        this.resolve()
        return
      }
      const path = this.pathList.shift()
      this._setTask(path)
      this._run(Promise.race(this.pool))
    })
  }

  private _setTask(path:string | undefined) {
    limitAmount.value ++
    if(!path) return
    const promise = this.cb(path)
    this.pool.push(promise)

    promise.then(() => {
      this.pool.splice(this.pool.indexOf(promise), 1)
      limitAmount.value --
    })

  }
}
</script>

<style scoped lang='stylus'>
</style>
