/**
 * @Date         : 2022-03-30 13:53:58
 * @Description  :
 * @Autor        : Qzr(z5021996@vip.qq.com)
 * @LastEditors  : Qzr(z5021996@vip.qq.com)
 * @LastEditTime : 2022-04-15 10:23:49
 */

import JSZip from 'jszip'
const options = { type: 'blob', compression: 'DEFLATE' }

self.addEventListener(
  'message',
  function (e) {
    let { zipName, fileList, pathInfo } = e.data
    const zip = new JSZip()
    for (const item of fileList) {
      const path = pathInfo[item.name]
      zip.file(path, item)
    }

    zip.generateAsync(options, metadata => {
      const percentage = metadata.percent.toFixed(2)
      const nowFile = metadata.currentFile
      self.postMessage({
        percentage, // 进度
        nowFile // 处理中的文件
      })
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
