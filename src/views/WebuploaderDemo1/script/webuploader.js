/**
 * @Date         : 2022-03-29 13:38:12
 * @Description  :
 * @Autor        : Qzr(z5021996@vip.qq.com)
 * @LastEditors  : Qzr(z5021996@vip.qq.com)
 * @LastEditTime : 2022-03-30 15:24:20
 */

import $ from 'jquery'
import WebUploader from '@/plugins/webUploader/webuploader.fis.js'
import api from '@/api'

let timestamp = 0
let md5stamp = 0
let size = 0

export default function () {
  const chunkSize = 1024 * 1024 * 5
  let uploader = WebUploader.create({
    // swf文件路径
    swf: '../../plugins/webUploader/Uploader.swf',
    // 文件接收服务端。
    server: '/api/upload',
    // 选择文件的按钮。可选。
    // 内部根据当前运行是创建，可能是input元素，也可能是flash.
    pick: {
      id: '#picker',     // 选择文件的按钮
      multiple: true,   // 是否多文件上传 默认false
    },
    // 是否开启自动上传
    auto: false,
    chunked: true,          // 是否要分片处理大文件上传
    chunkSize: chunkSize,    // 如果要分片，分多大一片？ 默认大小为5M
    chunkRetry: 2, // 如果某个分片由于网络问题出错，允许自动重传多少次
    duplicate: true,  // 去重， 根据文件名字、文件大小和最后修改时间来生成hash Key
    threads: 3, // 上传并发数。允许同时最大上传进程数。
    formData: {},
    prepareNextFile: true,  // 是否允许在文件传输时提前把下一个文件准备好 md5
  })

  $('#uploadBtn').click(() => {
    timestamp = new Date().getTime()
    uploader.upload()
  })

  uploader.on('beforeFileQueued', function(file) {
    console.log('文件加入队前', file)
  })

  // 当有文件被添加进队列的时候
  uploader.on('fileQueued', function(file) {
    console.log('文件加入队列后', file)

    size = file.size

    let $list = $('#fileList')
    $list.append('<div id="' + file.id + '" class="item">' +
                '<h4 class="info">' + file.name + '</h4>' +
                '<p class="state">等待上传...</p>' +
            '</div>')

    uploader.md5File(file)

    // 及时显示进度
      .progress(function(percentage) {
        if (md5stamp === 0) md5stamp = new Date().getTime()
        console.log('Percentage:', percentage)
      })

    // 完成
      .then(function(val) {
        console.log('md5 result:', val)
        md5stamp = new Date().getTime() - md5stamp
        console.log('计算md5时间', md5stamp)
        setInfo(file, val)
      })
  })

  // 文件上传过程中创建进度条实时显示。
  uploader.on('uploadProgress', function(file, percentage) {
    console.log('文件上传中')
    let $li = $('#' + file.id)
    let $percent = $li.find('.progress .progress-bar')
    // 避免重复创建
    if (!$percent.length) {
      $percent = $('<div class="progress progress-striped active">' +
                  '<div class="progress-bar" role="progressbar" style="width: 0%">' +
                  '</div>' +
                '</div>').appendTo($li).find('.progress-bar')
    }
    $li.find('p.state').text('上传中')
    $percent.css('width', percentage * 100 + '%')  // 根据上传进度改变进度条宽度
  })

  uploader.on('uploadSuccess', async function(file, response) {
    console.log('文件上传成功')
    await api.mergeChunks({
      size: chunkSize,
      filename: file.name
    })

    timestamp = new Date().getTime() - timestamp
    const sizeM = size / 1024 / 1024
    console.log('文件上传时间', timestamp)
    console.log('md5计算速度', sizeM / (md5stamp / 1000))
    console.log('上传速度', sizeM / (timestamp / 1000))
    console.log('总速度', sizeM / ((timestamp + md5stamp) / 1000))
    $('#' + file.id).find('p.state').text('已上传')
  })

  uploader.on('uploadError', function(file, reason) {
    console.log('文件上传失败', reason)
    $('#' + file.id).find('p.state').text('上传出错')
  })

  uploader.on('uploadComplete', function(file) {
    console.log('文件上传完成')
    $('#' + file.id).find('.progress').fadeOut()
  })

  // uploader.on('uploadStart', (file) => {
  //   // 	某个文件开始上传前触发，一个文件只会触发一次
  //   setInfo(file)
  //   console.log(uploader.options)
  // })

  uploader.on('uploadBeforeSend', (object, data, headers) => {
    // 当某个文件的分块在发送前触发
    console.log('thissssssssss', object, data, headers)
    uploader.options.fileVal = `${data.name}^${data.fileHash}^${object.chunk}`
    console.log(uploader.options)
  })

  function setInfo(file, hash) {
    uploader.options.formData.filename = file.name
    uploader.options.formData.fileHash = hash
    // uploader.options.formData.index = file.name

    // uploader.options.fileVal = file.name
  }

}
