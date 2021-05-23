// the node program that caputres local performance data
// and sends it up to the socket.io server

const os = require('os')
const osu = require('node-os-utils')
const io = require('socket.io-client')
const pm2 = require('pm2')

const url = process.env.NODE_ENV === 'LOCAL' ? 'http://127.0.0.1:4000' : 'https://performance-server.mauaznar.com'
const isDev = process.env.NODE_ENV === 'DEV'



if (isDev) {
    let perfDataInterval = setInterval(() => {
        performanceData().then(allData => {
            console.log(allData)
        })
        // osu.mem.info().then(data => {
        //     console.log(data)
        // })
        // osu.drive.info()
        //     .then(info => {
        //         console.log(info)
        //     })
        // os.uptime()
    }, 5000)
} else {
    let socket = io(url)

    socket.on('connect', () => {
        // console.log('I connected to the socket server... hooray!')


        // clientauth with single key value
        socket.emit('clientAuth', '23423')

        performanceData().then(allData => {
            socket.emit('initPerfData', allData)
        })


        // start sending over data on interval
        let perfDataInterval = setInterval(() => {
            performanceData().then(allData => {
                console.log(allData)
                socket.emit('perfData', allData)
            })
        }, 1000)

        socket.on('disconnect', () => {
            clearInterval(perfDataInterval)
        })

    })
}

function performanceData () {
    return new Promise(async (resolve, reject) => {
        const cpus = os.cpus()
        const osType = os.type() === 'Darwin' ? 'Mac' : os.type()

        const upTime = os.uptime()

        const memInfo = await osu.mem.info()
        // const freeMemPercentage = parseFloat((memInfo.freeMemPercentage).toFixed(2))

        const memusage = parseFloat((memInfo.usedMemPercentage).toFixed(2))
        const totalmem = memInfo.totalMemMb
        const freemem = memInfo.freeMemMb
        const usedmem = memInfo.usedMemMb

        const driveInfo = await osu.drive.info()


        const diskusage = driveInfo.usedPercentage
        const diskused = driveInfo.usedGb
        const diskfree = driveInfo.freeGb
        const disktotal = driveInfo.totalGb


        // const hostname = await osu.os.hostname()

        // console.log(hostname)

        const pm2List = await connectPm2()

        const cpuModel = cpus[0].model
        const cpuSpeed = cpus[0].speed
        const numCores = cpus.length
        const cpuLoad = await getCpuLoad()
        const isActive = true
        // We need a way to identify this machine to whomever concerned
        const nI = os.networkInterfaces()
        let macA
        // loop through all the Ni for this machine and find a non-internal one
        for(let key in nI) {

            // for testing purposes
            // macA = Math.floor((Math.random() * 3) + 1)
            // break;

            if (nI.hasOwnProperty(key)) {
                if (!nI[key][0].internal) {
                    macA = nI[key][0].mac
                    break;
                }
            }
        }

        resolve({
            diskusage,
            diskused,
            diskfree,
            disktotal,
            pm2List,
            upTime,
            osType,
            totalmem,
            freemem,
            usedmem,
            memusage,
            cpuModel,
            cpuSpeed,
            numCores,
            cpuLoad,
            isActive,
            macA
        })
    })
}


// cpus is all numCores, we need the average of all the cores which
// will give us the cpu average

function cpuAverage() {
    const cpusDynamic = os.cpus()
    // get ms in each mode, but this number is since reboot
    // so get it now and get it 100 ms and compare
    let idleMs = 0
    let totalMs = 0
    // loop through each core
    cpusDynamic.forEach((aCore) => {
        // loop through each property of the current core
        for(const type in aCore.times) {
            totalMs += aCore.times[type]
        }
        idleMs += aCore.times.idle
    })
    return {
        idle: idleMs / cpusDynamic.length,
        total: totalMs / cpusDynamic.length
    }
}

function connectPm2() {
    return new Promise(((resolve, reject) => {
        pm2.connect(err => {
            if (err) {
                reject('pm2 error')
            }
            pm2.list((err, list) => {
                resolve(list)
            })
        })
    }))
}


// because the times property is time since boot, we will get
// now times, and 100ms from now times. Compare them, that will
// gives us current load
function getCpuLoad() {
    return new Promise(((resolve, reject) => {
        const start = cpuAverage()
        setTimeout(() => {
            const end = cpuAverage()
            const idleDifference = end.idle - start.idle
            const totalDifference = end.total - start.total
            // calc the % of used cpu
            const percentageCpu = 100 - Math.floor(100 * idleDifference / totalDifference)
            resolve(percentageCpu)
        }, 100)
    }))
}

// command to make it crazy
// yes > /dev/null & yes > /dev/null & yes > /dev/null & yes > /dev/nul &
// killall yes
// setInterval(() => {
//     getCpuLoad()
// }, 1000)
