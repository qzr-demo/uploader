/**
 * @Date         : 2022-03-30 13:53:58
 * @Description  :
 * @Autor        : Qzr(z5021996@vip.qq.com)
 * @LastEditors  : Qzr(z5021996@vip.qq.com)
 * @LastEditTime : 2022-03-30 16:50:42
 */

self.importScripts('/node_modules/spark-md5')

// self.addEventListener('message', function (e) {
//   const { chunkArr } = e.data
//   const spark = new self.SparkMD5.ArrayBuffer()
//   const length = chunkArr.length

//   for (const [index, item] of chunkArr.entries()) {
//     const reader = new FileReader()
//     reader.readAsArrayBuffer(item.file)
//     reader.onload = e => {
//       if (index < length - 1) {
//         spark.append(e.target.result)
//         self.postMessage({
//           percentage: index / chunkArr.length
//         })
//       } else {
//         self.postMessage({
//           percentage: 100,
//           hash: spark.end()
//         })

//         self.close()
//       }
//     }
//   }

// }, false)

self.addEventListener('message', function (e) {
  const { chunkList } = e.data
  const spark = new self.SparkMD5.ArrayBuffer()
  let percentage = 0
  let count = 0
  const loadNext = index => {
    const reader = new FileReader()
    reader.readAsArrayBuffer(chunkList[index].file)
    reader.onload = e => {
      count++
      spark.append(e.target.result)
      if (count === chunkList.length) {
        self.postMessage({
          percentage: 100,
          hash: spark.end()
        })
        self.close()
      } else {
        percentage += 100 / chunkList.length
        self.postMessage({
          percentage
        })
        // 递归计算下一个切片
        loadNext(count)
      }
    }
  }
  loadNext(0)
}, false)

