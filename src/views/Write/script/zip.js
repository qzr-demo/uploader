/**
 * @Date         : 2022-03-30 13:53:58
 * @Description  :
 * @Autor        : Qzr(z5021996@vip.qq.com)
 * @LastEditors  : Qzr(z5021996@vip.qq.com)
 * @LastEditTime : 2022-04-12 17:00:42
 */

import JSZip from 'jszip'

self.addEventListener(
  'message',
  function (e) {
    let { fileList, zipName, options } = e.data
    const zip = new JSZip()
    for (const item of fileList) {
      const path = item.webkitRelativePath === '' ? item.path : item.webkitRelativePath
      zip.file(path, item)
    }

    console.log(zip)
    zip.generateAsync(options, metadata => {
      const percentage = metadata.percent.toFixed(2)
      const nowFile = metadata.currentFile
      console.log('metadata', metadata)
      self.postMessage({
        percentage,
        nowFile // 处理中的文件
      })
      console.log(percentage, nowFile)
    }).then((blob) => {
      zipName = zipName || Date.now() + '.zip'
      const zipFile = new File([blob], zipName, {
        type: 'application/zip',
      })
      self.postMessage({
        file: zipFile,
        percentage: 100
      })
      self.close()
    })
  },
  false
)
