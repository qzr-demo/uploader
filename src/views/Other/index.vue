<!--
 * @Date         : 2022-03-28 17:18:00
 * @Description  :
 * @Autor        : Qzr(z5021996@vip.qq.com)
 * @LastEditors  : Qzr(z5021996@vip.qq.com)
 * @LastEditTime : 2022-03-29 13:58:50
-->

<template>
  <div id="app">
    <div id="uploader"
         class="wu-example">
      <!--用来存放文件信息-->
      <div id="fileLilst"
           class="uploader-list" />
      <div class="btns">
        <!-- 选择文件的按钮 -->
        <div id="picker">选择文件</div>
        <!-- 开始上传按钮 -->
        <button id="uploadBtn"
                class="btn btn-default">开始上传</button>
      </div>
    </div>
    <div id="fileList" />
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import '@/plugins/webUploader/style.css'
import '@/plugins/webUploader/webuploader.css'
import main from './script/webuploader'

onMounted(() => {
  main()
})
</script>

<style scoped>
</style>
