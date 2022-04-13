<!--
 * @Date         : 2022-03-30 10:46:50
 * @Description  :
 * @Autor        : Qzr(z5021996@vip.qq.com)
 * @LastEditors  : Qzr(z5021996@vip.qq.com)
 * @LastEditTime : 2022-04-12 17:09:20
-->

<template>
  <div class="upload-container"
       @dragover="e => e.preventDefault()"
       @drop="e => e.preventDefault()">
    <div class="drag-container"
         @dragenter="dragenter"
         @dragleave="dragleave"
         @dragover="dragover"
         @drop="drop">{{ dragText }}</div>
    <!-- webkitdirectory input文件夹属性 -->
    <input id="input"
           type="file"
           webkitdirectory
           @change="fileChangeHandle($event, 0)">
    <el-button @click="uploadHandle">上传</el-button>
    <el-button @click="cancalUploadHandle(false)">取消全部</el-button>

    <div>
      <div>总耗时：{{ timestamp }}</div>
      <div>上传切片耗时：{{ uploadTimestamp }}</div>
      <div>计算hash耗时：{{ hashTimestamp }}</div>

      <div>当前切片上传并发数：{{ chunkLimitAmount }}</div>
      <div>当前文件上传并发数：{{ uploadPool.length }}</div>

      <div>当前压缩文件：{{ zipNowFile }}</div>

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
          :stroke-width="14"
          :percentage="totalFile ? Math.floor(completedHash / totalFile * 100) : 0" />
      </div>
      <div>
        上传分片进度：
        <el-progress
          :text-inside="true"
          :stroke-width="14"
          :percentage="totalChunk ? Math.floor(completedChunk/totalChunk*100) : 0" />
      </div>
      <div>
        压缩文件进度：
        <el-progress
          :text-inside="true"
          :stroke-width="14"
          :percentage="Number(zipPercent)" />
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
            :stroke-width="14"
            status="warning"
            :percentage="item.hashPercentage" />
        </div>
        <div>
          <!-- 上传进度：{{ Math.floor(item.completed / item.chunks * 100) }}% -->
          上传进度：
          <el-progress
            :text-inside="true"
            :stroke-width="14"
            status="success"
            :percentage="Math.floor(item.completed / item.chunks * 100)" />
        </div>
        <div v-for="(chunk, idx) in item.chunkList"
             :key="idx"
             class="text item">分块{{ chunk.chunk }}
          <el-progress
            :text-inside="true"
            :stroke-width="14"
            :percentage="chunk.progress" />
        </div>
      </el-card>
    </div>


  </div>
</template>

<script lang='ts' setup>

import useDrag from './hooks/useDrag'
import useUpload from './hooks/useUpload'

const CHUNKSIZE = 1024 * 1024 * 5 // 分片大小
const UPLOADLIMIT = 5 // 上传文件并发数
const CHUNKLIMIT = 2  // 分片并发数
const HASHLIMIT = 5 // 计算hash并发数
const ZIPSIZE = 1024 * 1024 * 20  // 需要进行压缩的文件最大值

const {
  uploadHandle, timestamp, uploadTimestamp, hashTimestamp, chunkLimitAmount,
  uploadPool, totalSize, totalChunk, completedChunk, totalFile, completedFile, failFile,
  completedHash, speed, averageSpeed, calcHashing, fileChunkList, cancalUploadHandle, checkState,
  uploadOne, fileChangeHandle, zipPercent, zipNowFile
} = useUpload(CHUNKSIZE, UPLOADLIMIT, CHUNKLIMIT, HASHLIMIT, ZIPSIZE)
const { dragenter, dragleave, drop, dragover, dragText } = useDrag(fileChangeHandle)



</script>

<style scoped lang='stylus'>
.file-box
  {$flex}
  flex-wrap wrap
  > div
    flex auto
    width 20vw
    margin 10px

.drag-container
  width 300px
  height 200px
  border 1px solid black

.upload-container
  width 100vw
  height 100vh
</style>
