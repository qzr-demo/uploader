<!--
 * @Date         : 2021-04-19 18:00:02
 * @Description  :
 * @Autor        : Qzr(z5021996@vip.qq.com)
 * @LastEditors  : Qzr(z5021996@vip.qq.com)
 * @LastEditTime : 2022-03-29 09:20:55
-->

<template>
  <div>
    <div id="wrapper">
      <div id="container">
        <!--头部，相册选择和格式选择-->

        <div id="uploader">
          <div class="queueList">
            <div id="dndArea"
                 class="placeholder">
              <div id="filePicker" />
              <p>或将照片拖到这里，单次最多可选300张</p>
            </div>
          </div>
          <div class="statusBar"
               style="display:none;">
            <div class="progress">
              <span class="text">0%</span>
              <span class="percentage" />
            </div><div class="info" />
            <div class="btns">
              <div id="filePicker2" /><div class="uploadBtn">开始上传</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang='ts' setup>
import '@/plugins/webUploader/style.css'
import '@/plugins/webUploader/webuploader.css'
import './script/upload'

import { ref } from 'vue'

</script>

<style scoped lang='stylus'>

</style>
