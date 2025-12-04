// index.js
Page({
  data: {
    // 蓝牙相关状态
    isScanning: false,
    devices: [],
    connectionStatus: '未连接',
    connectedDeviceId: '',
    characteristics: [],
    selectedCharacteristic: '',
    selectedServiceId: '',
    
    // 数据发送接收相关
    sendData: '',
    sendType: 'text',
    receiveData: '',
    
    // 服务和特征值缓存
    services: []
  },

  onLoad() {
    // 页面加载时清除之前的数据
    this.setData({
      devices: [],
      characteristics: [],
      receiveData: ''
    })
  },

  // 初始化蓝牙适配器
  openBluetoothAdapter() {
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('蓝牙适配器初始化成功', res)
        wx.showToast({ title: '蓝牙初始化成功' })
        
        // 监听蓝牙连接状态变化
        this.onBluetoothDeviceFound()
        this.onBLEConnectionStateChange()
        this.onBLECharacteristicValueChange()
      },
      fail: (err) => {
        console.error('蓝牙适配器初始化失败', err)
        wx.showToast({
          title: '蓝牙初始化失败',
          icon: 'error'
        })
        if (err.errCode === 10001) {
          wx.showModal({
            title: '提示',
            content: '请打开手机蓝牙',
            showCancel: false
          })
        }
      }
    })
  },

  // 开始搜索蓝牙设备
  startBluetoothDevicesDiscovery() {
    if (this.data.isScanning) return
    
    // 清空设备列表
    this.setData({
      devices: []
    })
    
    wx.startBluetoothDevicesDiscovery({
      services: [], // 搜索所有服务的设备
      allowDuplicatesKey: false,
      success: (res) => {
        console.log('开始搜索设备', res)
        this.setData({
          isScanning: true
        })
        wx.showToast({ title: '开始搜索设备' })
        
        // 10秒后自动停止搜索
        setTimeout(() => {
          this.stopBluetoothDevicesDiscovery()
        }, 10000)
      },
      fail: (err) => {
        console.error('搜索设备失败', err)
        wx.showToast({
          title: '搜索失败',
          icon: 'error'
        })
      }
    })
  },

  // 停止搜索蓝牙设备
  stopBluetoothDevicesDiscovery() {
    wx.stopBluetoothDevicesDiscovery({
      success: (res) => {
        console.log('停止搜索设备', res)
        this.setData({
          isScanning: false
        })
      },
      fail: (err) => {
        console.error('停止搜索失败', err)
      }
    })
  },

  // 监听发现新设备
  onBluetoothDeviceFound() {
    wx.onBluetoothDeviceFound((res) => {
      const devices = res.devices || []
      devices.forEach(device => {
        // 过滤重复设备
        const existingDeviceIndex = this.data.devices.findIndex(d => d.deviceId === device.deviceId)
        if (existingDeviceIndex === -1 && device.name) {
          // 只添加有名称的设备
          const newDevices = [...this.data.devices, device]
          this.setData({
            devices: newDevices
          })
        } else if (existingDeviceIndex !== -1) {
          // 更新已存在设备的信号强度
          const newDevices = [...this.data.devices]
          newDevices[existingDeviceIndex].RSSI = device.RSSI
          this.setData({
            devices: newDevices
          })
        }
      })
    })
  },

  // 监听连接状态变化
  onBLEConnectionStateChange() {
    wx.onBLEConnectionStateChange((res) => {
      console.log('连接状态变化', res)
      const { connected, deviceId } = res
      
      if (deviceId === this.data.connectedDeviceId) {
        if (connected) {
          this.setData({
            connectionStatus: '已连接'
          })
          // 连接成功后获取服务
          this.getBLEDeviceServices(deviceId)
        } else {
          this.setData({
            connectionStatus: '连接已断开',
            connectedDeviceId: '',
            characteristics: [],
            selectedCharacteristic: '',
            selectedServiceId: '',
            services: []
          })
        }
      }
    })
  },

  // 监听特征值变化（接收数据）
  onBLECharacteristicValueChange() {
    wx.onBLECharacteristicValueChange((res) => {
      console.log('接收到数据', res)
      const { value, characteristicId } = res
      
      // 将ArrayBuffer转换为字符串
      let receivedText = ''
      const uint8Array = new Uint8Array(value)
      
      // 尝试解析为文本
      try {
        receivedText = this.arrayBufferToString(value)
      } catch (e) {
        // 如果解析失败，显示十六进制
        receivedText = Array.from(uint8Array, byte => byte.toString(16).padStart(2, '0')).join(' ')
      }
      
      const now = new Date()
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`
      
      this.setData({
        receiveData: this.data.receiveData + `[${timeStr}] 接收: ${receivedText}\n`
      })
    })
  },

  // 连接蓝牙设备
  connectDevice(e) {
    const { deviceId, deviceName } = e.currentTarget.dataset
    
    // 先停止搜索
    this.stopBluetoothDevicesDiscovery()
    
    wx.showLoading({ title: '正在连接...' })
    
    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        console.log('连接设备成功', res)
        this.setData({
          connectedDeviceId: deviceId,
          connectionStatus: `已连接: ${deviceName || '未知设备'}`
        })
        wx.hideLoading()
        wx.showToast({ title: '连接成功' })
      },
      fail: (err) => {
        console.error('连接设备失败', err)
        wx.hideLoading()
        wx.showToast({
          title: '连接失败',
          icon: 'error'
        })
      }
    })
  },

  // 获取设备服务
  getBLEDeviceServices(deviceId) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        console.log('获取服务成功', res.services)
        this.setData({
          services: res.services
        })
        
        // 遍历所有服务获取特征值
        res.services.forEach(service => {
          this.getBLEDeviceCharacteristics(deviceId, service.uuid)
        })
      },
      fail: (err) => {
        console.error('获取服务失败', err)
      }
    })
  },

  // 获取设备特征值
  getBLEDeviceCharacteristics(deviceId, serviceId) {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('获取特征值成功', res.characteristics)
        
        // 添加特征值到列表，包含服务ID信息
        const newCharacteristics = res.characteristics.map(char => ({
          ...char,
          serviceId
        }))
        
        this.setData({
          characteristics: [...this.data.characteristics, ...newCharacteristics]
        })
        
        // 对可读取的特征值进行订阅
        res.characteristics.forEach(characteristic => {
          if (characteristic.properties.notify || characteristic.properties.indicate) {
            this.notifyBLECharacteristicValueChange(deviceId, serviceId, characteristic.uuid, true)
          }
        })
      },
      fail: (err) => {
        console.error('获取特征值失败', err)
      }
    })
  },

  // 订阅特征值
  notifyBLECharacteristicValueChange(deviceId, serviceId, characteristicId, state) {
    wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId,
      characteristicId,
      state,
      success: (res) => {
        console.log('订阅特征值成功', res)
      },
      fail: (err) => {
        console.error('订阅特征值失败', err)
      }
    })
  },

  // 选择特征值
  selectCharacteristic(e) {
    const { uuid, serviceId } = e.currentTarget.dataset
    this.setData({
      selectedCharacteristic: uuid,
      selectedServiceId: serviceId
    })
    wx.showToast({ title: '已选择特征值' })
  },

  // 发送数据
  sendDataToDevice() {
    const { connectedDeviceId, selectedServiceId, selectedCharacteristic, sendData, sendType } = this.data
    
    if (!connectedDeviceId) {
      wx.showToast({
        title: '请先连接设备',
        icon: 'error'
      })
      return
    }
    
    if (!selectedCharacteristic || !selectedServiceId) {
      wx.showToast({
        title: '请选择特征值',
        icon: 'error'
      })
      return
    }
    
    if (!sendData) {
      wx.showToast({
        title: '请输入发送数据',
        icon: 'error'
      })
      return
    }
    
    let buffer
    if (sendType === 'text') {
      // 文本转ArrayBuffer
      buffer = this.stringToArrayBuffer(sendData)
    } else {
      // 十六进制转ArrayBuffer
      buffer = this.hexStringToArrayBuffer(sendData)
    }
    
    wx.writeBLECharacteristicValue({
      deviceId: connectedDeviceId,
      serviceId: selectedServiceId,
      characteristicId: selectedCharacteristic,
      value: buffer,
      success: (res) => {
        console.log('发送数据成功', res)
        const now = new Date()
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`
        
        this.setData({
          receiveData: this.data.receiveData + `[${timeStr}] 发送: ${sendData}\n`
        })
        
        wx.showToast({ title: '发送成功' })
      },
      fail: (err) => {
        console.error('发送数据失败', err)
        wx.showToast({
          title: '发送失败',
          icon: 'error'
        })
      }
    })
  },

  // 输入发送数据
  onSendDataInput(e) {
    this.setData({
      sendData: e.detail.value
    })
  },

  // 切换发送类型
  onSendTypeChange(e) {
    this.setData({
      sendType: e.detail.value
    })
  },

  // 工具方法：字符串转ArrayBuffer
  stringToArrayBuffer(str) {
    const buf = new ArrayBuffer(str.length)
    const bufView = new Uint8Array(buf)
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i)
    }
    return buf
  },

  // 工具方法：ArrayBuffer转字符串
  arrayBufferToString(buffer) {
    const uint8Array = new Uint8Array(buffer)
    let str = ''
    for (let i = 0; i < uint8Array.length; i++) {
      str += String.fromCharCode(uint8Array[i])
    }
    return str
  },

  // 工具方法：十六进制字符串转ArrayBuffer
  hexStringToArrayBuffer(hexString) {
    // 移除空格
    hexString = hexString.replace(/\s/g, '')
    
    // 确保字符串长度为偶数
    if (hexString.length % 2 !== 0) {
      hexString = '0' + hexString
    }
    
    const byteLength = hexString.length / 2
    const buffer = new ArrayBuffer(byteLength)
    const bufView = new Uint8Array(buffer)
    
    for (let i = 0; i < byteLength; i++) {
      bufView[i] = parseInt(hexString.substr(i * 2, 2), 16)
    }
    
    return buffer
  }
})
